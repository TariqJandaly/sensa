import { prisma } from '#/db'
import {
  DEFAULT_THRESHOLDS,
  evaluateReading,
} from '@sensa/contracts'
import type { EventType, ReadingInput, Thresholds } from '@sensa/contracts'

import { hashDeviceToken } from './device-auth.server'
import { sendPush, pushConfigured } from './push.server'

/**
 * The alert engine. The device computes its own status, but the server
 * re-evaluates every reading so it stays the source of truth for alerts
 * and history. ALERT events dedupe on a cooldown so one shaky minute
 * does not spam a family's phones; SOS always raises immediately.
 */

const ALERT_COOLDOWN_MS = 5 * 60 * 1000
const OFFLINE_AFTER_MS = 90 * 1000
const MAX_BATCH_PER_MINUTE = 120

/** GSR baseline per device, in memory; re-seeded from the DB on demand. */
const gsrBaselines = new Map<string, number>()

/** Naive per-device rate limit for the ingest routes (dev single process). */
const ingestHits = new Map<string, number[]>()
function rateLimited(deviceId: string): boolean {
  const now = Date.now()
  const hits = (ingestHits.get(deviceId) ?? []).filter((t) => now - t < 60_000)
  if (hits.length >= MAX_BATCH_PER_MINUTE) {
    ingestHits.set(deviceId, hits)
    return true
  }
  hits.push(now)
  ingestHits.set(deviceId, hits)
  return false
}

export function deviceTokenFromRequest(request: Request): string | null {
  const header = request.headers.get('x-sensa-device-token')
  if (header) return header
  const authz = request.headers.get('authorization')
  if (authz?.toLowerCase().startsWith('bearer ')) return authz.slice(7).trim()
  return null
}

export async function deviceByToken(token: string) {
  const tokenHash = hashDeviceToken(token)
  return prisma.device.findUnique({
    where: { tokenHash },
    include: { threshold: true, members: { include: { user: true } } },
  })
}

const FLAG_AR: Record<string, string> = {
  'heart rate high': 'نبض مرتفع',
  'heart rate low': 'نبض منخفض',
  'SpO2 low': 'أكسجين منخفض',
  'temperature high': 'حرارة مرتفعة',
  'GSR signal changed': 'تغير في استجابة الجلد',
  'motion changed': 'تغير في الحركة',
}
const FLAG_EN: Record<string, string> = {
  'heart rate high': 'high heart rate',
  'heart rate low': 'low heart rate',
  'SpO2 low': 'low oxygen',
  'temperature high': 'high temperature',
  'GSR signal changed': 'skin response change',
  'motion changed': 'motion change',
}

function notificationFor(
  wearerName: string,
  type: EventType,
  flags: string[],
  locale: string,
) {
  const ar = locale !== 'en'
  if (type === 'SOS') {
    return {
      title: ar ? `استغاثة من ${wearerName}` : `${wearerName} pressed SOS`,
      body: ar ? 'تم إرسال الموقع. افتح التطبيق للتفاصيل.' : 'Location sent. Open the app for details.',
      url: '/app/alerts',
      tag: 'sensa-sos',
    }
  }
  const reasons = flags.map((f) => (ar ? FLAG_AR[f] ?? f : FLAG_EN[f] ?? f)).join(ar ? '، ' : ', ')
  return {
    title: ar ? `تنبيه من ساعة ${wearerName}` : `Alert from ${wearerName}'s watch`,
    body: reasons || (ar ? 'قراءات غير طبيعية' : 'Abnormal readings'),
    url: '/app/alerts',
    tag: 'sensa-alert',
  }
}

/** Push to every member with notifications on; prune dead subscriptions. */
async function fanOut(
  deviceId: string,
  wearerName: string,
  type: EventType,
  flags: string[],
) {
  if (!pushConfigured) return
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: { memberships: { some: { deviceId, notify: true } } },
    },
    include: { user: { select: { locale: true } } },
  })
  for (const subscription of subscriptions) {
    const payload = notificationFor(wearerName, type, flags, subscription.user.locale)
    const result = await sendPush(subscription, payload)
    if (result.gone) {
      console.log(`[push] subscription gone (user ${subscription.userId}), pruned`)
      await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => {})
    } else if (!result.ok) {
      console.log(`[push] delivery failed for user ${subscription.userId}`)
    } else {
      console.log(`[push] delivered to user ${subscription.userId}: ${type}`)
    }
  }
}

export interface EventInput {
  type: EventType
  capturedAt: Date
  lat?: number
  lng?: number
  notify?: boolean
  flags?: string[]
}

export async function raiseEvent(deviceId: string, input: EventInput) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: { members: { where: { role: 'WEARER' }, include: { user: true }, take: 1 } },
  })
  const event = await prisma.event.create({
    data: {
      deviceId,
      type: input.type,
      capturedAt: input.capturedAt,
      lat: input.lat,
      lng: input.lng,
      payload: input.flags ? { flags: input.flags } : undefined,
    },
  })
  if (input.notify && device) {
    const wearerName = device.members[0]?.user.name ?? device.name
    await fanOut(deviceId, wearerName, input.type, input.flags ?? [])
  }
  return event
}

export type IngestResult =
  | { ok: true; accepted: number; alertsRaised: number }
  | { ok: false; status: number; error: string }

export async function ingestReadings(
  token: string,
  batch: { deviceId: string; readings: ReadingInput[] },
): Promise<IngestResult> {
  const device = await deviceByToken(token)
  if (!device) return { ok: false, status: 401, error: 'unknown device token' }
  if (device.id !== batch.deviceId) {
    return { ok: false, status: 400, error: 'deviceId does not match token' }
  }
  if (rateLimited(device.id)) {
    return { ok: false, status: 429, error: 'rate limited' }
  }

  const thresholds: Thresholds = device.threshold
    ? {
        tempHighC: device.threshold.tempHighC,
        hrLowBpm: device.threshold.hrLowBpm,
        hrHighBpm: device.threshold.hrHighBpm,
        spo2LowPct: device.threshold.spo2LowPct,
        gsrChangeThreshold: device.threshold.gsrChangeThreshold,
        motionDeltaThreshold: device.threshold.motionDeltaThreshold,
      }
    : { ...DEFAULT_THRESHOLDS }

  if (!gsrBaselines.has(device.id)) {
    const last = await prisma.reading.findFirst({
      where: { deviceId: device.id, gsrOhm: { not: null } },
      orderBy: { capturedAt: 'desc' },
      select: { gsrOhm: true },
    })
    if (last?.gsrOhm != null) {
      gsrBaselines.set(device.id, last.gsrOhm)
    }
  }

  let alertsRaised = 0
  const rows = batch.readings.map((reading) => {
    const baseline = gsrBaselines.get(device.id) ?? null
    const { status, flags } = evaluateReading(reading, thresholds, baseline)
    if (reading.gsrOhm != null) {
      const next =
        baseline == null
          ? reading.gsrOhm
          : 0.95 * baseline + 0.05 * reading.gsrOhm
      gsrBaselines.set(device.id, next)
    }
    return { reading, status, flags }
  })

  await prisma.reading.createMany({
    data: rows.map(({ reading, status, flags }) => ({
      deviceId: device.id,
      capturedAt: new Date(reading.capturedAt),
      hrBpm: reading.hrBpm ?? null,
      spo2Pct: reading.spo2Pct ?? null,
      tempC: reading.tempC ?? null,
      gsrOhm: reading.gsrOhm ?? null,
      accelX: reading.accelX ?? null,
      accelY: reading.accelY ?? null,
      accelZ: reading.accelZ ?? null,
      status,
      flags: { flags },
    })),
  })

  const last = rows[rows.length - 1]
  const now = new Date()
  const lastCapturedAt = new Date(last.reading.capturedAt)
  await prisma.device.update({
    where: { id: device.id },
    data: {
      status: 'ONLINE',
      lastSeenAt: lastCapturedAt > now ? now : lastCapturedAt,
    },
  })

  // Escalation -> one ALERT event per cooldown window.
  if (last.status === 'ALERT') {
    const since = new Date(Date.now() - ALERT_COOLDOWN_MS)
    const recentAlert = await prisma.event.findFirst({
      where: { deviceId: device.id, type: 'ALERT', capturedAt: { gte: since } },
      select: { id: true },
    })
    if (!recentAlert) {
      await raiseEvent(device.id, {
        type: 'ALERT',
        capturedAt: lastCapturedAt,
        notify: true,
        flags: last.flags,
      })
      alertsRaised++
    }
  }

  return { ok: true, accepted: rows.length, alertsRaised }
}

export async function ingestSos(
  token: string,
  deviceId: string,
  input: { capturedAt: string; lat: number; lng: number },
): Promise<IngestResult> {
  const device = await deviceByToken(token)
  if (!device) return { ok: false, status: 401, error: 'unknown device token' }
  if (device.id !== deviceId) {
    return { ok: false, status: 400, error: 'deviceId does not match token' }
  }
  if (rateLimited(device.id)) {
    return { ok: false, status: 429, error: 'rate limited' }
  }
  await raiseEvent(device.id, {
    type: 'SOS',
    capturedAt: new Date(input.capturedAt),
    lat: input.lat,
    lng: input.lng,
    notify: true,
  })
  return { ok: true, accepted: 1, alertsRaised: 1 }
}

export async function ingestHeartbeat(
  token: string,
  deviceId: string,
  input: { ts: string; batteryPct?: number | null },
): Promise<IngestResult> {
  const device = await deviceByToken(token)
  if (!device) return { ok: false, status: 401, error: 'unknown device token' }
  if (device.id !== deviceId) {
    return { ok: false, status: 400, error: 'deviceId does not match token' }
  }
  const ts = new Date(input.ts)
  await prisma.device.update({
    where: { id: device.id },
    data: {
      status: 'ONLINE',
      lastSeenAt: ts,
      batteryPct: input.batteryPct ?? undefined,
    },
  })
  if (device.status === 'OFFLINE') {
    await raiseEvent(device.id, { type: 'ONLINE', capturedAt: ts })
  }
  return { ok: true, accepted: 1, alertsRaised: 0 }
}

/** Lazy sweep on reads: mark devices OFFLINE once their feed goes quiet. */
export async function sweepOffline(deviceId: string) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } })
  if (!device || device.status !== 'ONLINE' || !device.lastSeenAt) return
  const age = Date.now() - device.lastSeenAt.getTime()
  if (age > OFFLINE_AFTER_MS) {
    await prisma.device.update({
      where: { id: device.id },
      data: { status: 'OFFLINE' },
    })
    await raiseEvent(device.id, {
      type: 'OFFLINE',
      capturedAt: new Date(device.lastSeenAt.getTime() + OFFLINE_AFTER_MS),
    })
  }
}
