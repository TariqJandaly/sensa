import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { prisma } from '#/db'
import { auth } from '#/lib/auth'
import {
  DEFAULT_THRESHOLDS,
  thresholdsSchema,
} from '@sensa/contracts'
import type { Thresholds, ReadingInput, EventType } from '@sensa/contracts'

import {
  generateDeviceToken,
  generatePairingCode,
  hashDeviceToken,
} from '#/lib/device-auth.server'
import { sweepOffline } from '#/lib/alerts.server'

/**
 * The app's data layer: provisioning, membership, thresholds, live data.
 * Every function requires a signed-in user via the request session.
 */

// ---------- shared types (serialized for the client) ----------

export interface AppDevice {
  id: string
  name: string
  status: 'ONLINE' | 'OFFLINE'
  batteryPct: number | null
  isDemo: boolean
  lastSeenAt: string | null
  pairingCode: string | null
}

export interface AppMember {
  id: string
  name: string
  email: string
  role: 'WEARER' | 'CAREGIVER'
  notify: boolean
  you: boolean
}

export interface AppEvent {
  id: string
  type: EventType
  capturedAt: string
  lat: number | null
  lng: number | null
  acknowledgedBy: string | null
  acknowledgedAt: string | null
}

export interface AppData {
  anchor: number
  hasDevice: boolean
  userName: string
  device: AppDevice | null
  wearer: { name: string }
  members: AppMember[]
  thresholds: Thresholds
  readings: ReadingInput[]
  events: AppEvent[]
}

export interface CreatedDevice {
  device: AppDevice
  /** Shown exactly once, never stored in the clear again. */
  token: string
}

type ErrorCode =
  | 'UNAUTH'
  | 'NOT_FOUND'
  | 'NOT_MEMBER'
  | 'EMAIL_UNKNOWN'
  | 'ALREADY_MEMBER'
  | 'SELF'
  | 'WEARER'
  | 'INVALID'

export type ActionResult<T> = { ok: true; data: T } | { ok: false; code: ErrorCode }

// ---------- session + membership ----------

async function requireUser() {
  const request = getRequest()
  if (!request) return null
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return null
  return session.user
}

async function requireMembership(userId: string, deviceId: string) {
  return prisma.deviceMember.findFirst({
    where: { userId, deviceId },
  })
}

// ---------- data shaping ----------

const READING_WINDOW_MS = 3 * 60 * 60 * 1000
const READING_WINDOW_CAP = 400

function toReading(row: {
  capturedAt: Date
  hrBpm: number | null
  spo2Pct: number | null
  tempC: number | null
  gsrOhm: number | null
  accelX: number | null
  accelY: number | null
  accelZ: number | null
  status: string
  flags: unknown
}): ReadingInput {
  const flags = row.flags && typeof row.flags === 'object' && 'flags' in (row.flags as Record<string, unknown>)
    ? ((row.flags as { flags: unknown }).flags as string[])
    : []
  return {
    capturedAt: row.capturedAt.toISOString(),
    hrBpm: row.hrBpm,
    spo2Pct: row.spo2Pct,
    tempC: row.tempC,
    gsrOhm: row.gsrOhm,
    accelX: row.accelX,
    accelY: row.accelY,
    accelZ: row.accelZ,
    status: (row.status as ReadingInput['status']) ?? 'SAFE',
    flags: Array.isArray(flags) ? flags : [],
  }
}

function thresholdsOf(row: {
  tempHighC: number
  hrLowBpm: number
  hrHighBpm: number
  spo2LowPct: number
  gsrChangeThreshold: number
  motionDeltaThreshold: number
} | null): Thresholds {
  return row
    ? {
        tempHighC: row.tempHighC,
        hrLowBpm: row.hrLowBpm,
        hrHighBpm: row.hrHighBpm,
        spo2LowPct: row.spo2LowPct,
        gsrChangeThreshold: row.gsrChangeThreshold,
        motionDeltaThreshold: row.motionDeltaThreshold,
      }
    : { ...DEFAULT_THRESHOLDS }
}

async function buildAppData(userId: string, userName: string): Promise<AppData> {
  const memberships = await prisma.deviceMember.findMany({
    where: { userId },
    select: { deviceId: true },
  })
  const deviceIds = memberships.map((m) => m.deviceId)

  if (deviceIds.length === 0) {
    return {
      anchor: Date.now(),
      hasDevice: false,
      userName,
      device: null,
      wearer: { name: userName },
      members: [],
      thresholds: { ...DEFAULT_THRESHOLDS },
      readings: [],
      events: [],
    }
  }

  const device = await prisma.device.findFirst({
    where: { id: { in: deviceIds } },
    orderBy: { createdAt: 'asc' },
    include: { members: { include: { user: true } }, threshold: true },
  })
  if (!device) {
    return {
      anchor: Date.now(),
      hasDevice: false,
      userName,
      device: null,
      wearer: { name: userName },
      members: [],
      thresholds: { ...DEFAULT_THRESHOLDS },
      readings: [],
      events: [],
    }
  }

  await sweepOffline(device.id)

  const since = new Date(Date.now() - READING_WINDOW_MS)
  const readings = await prisma.reading.findMany({
    where: { deviceId: device.id, capturedAt: { gte: since } },
    orderBy: { capturedAt: 'asc' },
    take: READING_WINDOW_CAP,
  })
  const events = await prisma.event.findMany({
    where: { deviceId: device.id },
    orderBy: { capturedAt: 'desc' },
    take: 12,
  })

  const freshDevice = await prisma.device.findUnique({ where: { id: device.id } })

  return {
    anchor: Date.now(),
    hasDevice: true,
    userName,
    device: {
      id: (freshDevice ?? device).id,
      name: (freshDevice ?? device).name,
      status: ((freshDevice ?? device).status === 'ONLINE' ? 'ONLINE' : 'OFFLINE') as
        | 'ONLINE'
        | 'OFFLINE',
      batteryPct: (freshDevice ?? device).batteryPct,
      isDemo: (freshDevice ?? device).isDemo,
      lastSeenAt: (freshDevice ?? device).lastSeenAt?.toISOString() ?? null,
      pairingCode: device.pairingCode,
    },
    wearer: {
      name:
        device.members.find((m) => m.role === 'WEARER')?.user.name ?? device.name,
    },
    members: device.members
      .slice()
      .sort((a, b) => (a.role === 'WEARER' ? -1 : b.role === 'WEARER' ? 1 : a.user.name.localeCompare(b.user.name)))
      .map((member) => ({
        id: member.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role as 'WEARER' | 'CAREGIVER',
        notify: member.notify,
        you: member.userId === userId,
      })),
    thresholds: thresholdsOf(device.threshold),
    readings: readings.map(toReading),
    events: events.map((event) => ({
      id: event.id,
      type: event.type as EventType,
      capturedAt: event.capturedAt.toISOString(),
      lat: event.lat,
      lng: event.lng,
      acknowledgedBy: event.acknowledgedBy,
      acknowledgedAt: event.acknowledgedAt?.toISOString() ?? null,
    })),
  }
}

// ---------- reads ----------

export const getAppData = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  if (!user) return { ok: false as const, code: 'UNAUTH' as ErrorCode }
  const data = await buildAppData(user.id, user.name)
  return { ok: true as const, data }
})

export const getHistoryData = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  if (!user) return { ok: false as const, code: 'UNAUTH' as ErrorCode }
  const memberships = await prisma.deviceMember.findMany({
    where: { userId: user.id },
    select: { deviceId: true },
  })
  if (memberships.length === 0) {
    return {
      ok: true as const,
      data: { anchor: Date.now(), readings: [] as ReadingInput[] },
    }
  }
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const device = await prisma.device.findFirst({
    where: { id: { in: memberships.map((m) => m.deviceId) } },
    orderBy: { createdAt: 'asc' },
  })
  const readings = device
    ? await prisma.reading.findMany({
        where: { deviceId: device.id, capturedAt: { gte: since } },
        orderBy: { capturedAt: 'asc' },
        take: 6000,
      })
    : []
  return {
    ok: true as const,
    data: { anchor: Date.now(), readings: readings.map(toReading) },
  }
})

// ---------- provisioning ----------

async function provisionDevice(
  userId: string,
  name: string,
  isDemo: boolean,
): Promise<ActionResult<CreatedDevice>> {
  const token = generateDeviceToken()
  const device = await prisma.device.create({
    data: {
      name,
      ownerId: userId,
      tokenHash: hashDeviceToken(token),
      pairingCode: generatePairingCode(),
      isDemo,
      status: 'OFFLINE',
      threshold: { create: { ...DEFAULT_THRESHOLDS } },
      members: {
        create: { userId, role: 'WEARER', notify: true },
      },
    },
  })
  return {
    ok: true,
    data: {
      device: {
        id: device.id,
        name: device.name,
        status: 'OFFLINE',
        batteryPct: null,
        isDemo: device.isDemo,
        lastSeenAt: null,
        pairingCode: device.pairingCode,
      },
      token,
    },
  }
}

export const createDevice = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const name = typeof input === 'object' && input !== null && 'name' in input
      ? String((input as { name: unknown }).name).trim()
      : ''
    if (!name || name.length > 60) return { ok: false as const }
    return { ok: true as const, name }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (!user) return { ok: false as const, code: 'UNAUTH' as ErrorCode }
    if (!data.ok) return { ok: false as const, code: 'INVALID' as ErrorCode }
    return provisionDevice(user.id, data.name, false)
  })

export const createDemoDevice = createServerFn({ method: 'POST' }).handler(async () => {
  const user = await requireUser()
  if (!user) return { ok: false as const, code: 'UNAUTH' as ErrorCode }
  return provisionDevice(user.id, 'جهاز تجريبي', true)
})

export const joinDevice = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const code = typeof input === 'object' && input !== null && 'code' in input
      ? String((input as { code: unknown }).code).trim().toUpperCase()
      : ''
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return { ok: false as const }
    return { ok: true as const, code }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (!user) return { ok: false as const, code: 'UNAUTH' as ErrorCode }
    if (!data.ok) return { ok: false as const, code: 'INVALID' as ErrorCode }
    const device = await prisma.device.findUnique({ where: { pairingCode: data.code } })
    if (!device) return { ok: false as const, code: 'NOT_FOUND' as ErrorCode }
    const existing = await requireMembership(user.id, device.id)
    if (existing) return { ok: false as const, code: 'ALREADY_MEMBER' as ErrorCode }
    await prisma.deviceMember.create({
      data: { deviceId: device.id, userId: user.id, role: 'CAREGIVER', notify: true },
    })
    return { ok: true as const, data: { deviceId: device.id, name: device.name } }
  })

// ---------- caregivers ----------

export const addCaregiver = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const body = (typeof input === 'object' && input !== null ? input : {}) as {
      deviceId?: unknown
      email?: unknown
    }
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!deviceId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false as const }
    }
    return { ok: true as const, deviceId, email }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (!user) return { ok: false as const, code: 'UNAUTH' as ErrorCode }
    if (!data.ok) return { ok: false as const, code: 'INVALID' as ErrorCode }
    const membership = await requireMembership(user.id, data.deviceId)
    if (!membership) return { ok: false as const, code: 'NOT_MEMBER' as ErrorCode }
    const target = await prisma.user.findFirst({ where: { email: data.email } })
    if (!target) return { ok: false as const, code: 'EMAIL_UNKNOWN' as ErrorCode }
    if (target.id === user.id) return { ok: false as const, code: 'SELF' as ErrorCode }
    const existing = await requireMembership(target.id, data.deviceId)
    if (existing) return { ok: false as const, code: 'ALREADY_MEMBER' as ErrorCode }
    const member = await prisma.deviceMember.create({
      data: { deviceId: data.deviceId, userId: target.id, role: 'CAREGIVER', notify: true },
    })
    return { ok: true as const, data: { id: member.id, name: target.name } }
  })

export const setMemberNotify = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const body = (typeof input === 'object' && input !== null ? input : {}) as {
      memberId?: unknown
      notify?: unknown
    }
    if (typeof body.memberId !== 'string' || typeof body.notify !== 'boolean') {
      return { ok: false as const }
    }
    return { ok: true as const, memberId: body.memberId, notify: body.notify }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (!user) return { ok: false as const, code: 'UNAUTH' as ErrorCode }
    if (!data.ok) return { ok: false as const, code: 'INVALID' as ErrorCode }
    const member = await prisma.deviceMember.findUnique({
      where: { id: data.memberId },
    })
    if (!member) return { ok: false as const, code: 'NOT_FOUND' as ErrorCode }
    const caller = await requireMembership(user.id, member.deviceId)
    if (!caller) return { ok: false as const, code: 'NOT_MEMBER' as ErrorCode }
    await prisma.deviceMember.update({
      where: { id: member.id },
      data: { notify: data.notify },
    })
    return { ok: true as const, data: { memberId: member.id, notify: data.notify } }
  })

export const removeMember = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const memberId = typeof input === 'object' && input !== null && 'memberId' in input
      ? String((input as { memberId: unknown }).memberId)
      : ''
    if (!memberId) return { ok: false as const }
    return { ok: true as const, memberId }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (!user) return { ok: false as const, code: 'UNAUTH' as ErrorCode }
    if (!data.ok) return { ok: false as const, code: 'INVALID' as ErrorCode }
    const member = await prisma.deviceMember.findUnique({ where: { id: data.memberId } })
    if (!member) return { ok: false as const, code: 'NOT_FOUND' as ErrorCode }
    const caller = await requireMembership(user.id, member.deviceId)
    if (!caller) return { ok: false as const, code: 'NOT_MEMBER' as ErrorCode }
    if (member.role === 'WEARER') return { ok: false as const, code: 'WEARER' as ErrorCode }
    await prisma.deviceMember.delete({ where: { id: member.id } })
    return { ok: true as const, data: { memberId: member.id } }
  })

// ---------- thresholds ----------

export const updateThresholds = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const parsed = thresholdsSchema.safeParse(input && typeof input === 'object' ? (input as { deviceId?: string; thresholds?: unknown }) : {})
    if (!parsed.success || !('deviceId' in (input as object))) return { ok: false as const }
    const deviceId = String((input as { deviceId: string }).deviceId)
    return { ok: true as const, deviceId, thresholds: parsed.data }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (!user) return { ok: false as const, code: 'UNAUTH' as ErrorCode }
    if (!data.ok) return { ok: false as const, code: 'INVALID' as ErrorCode }
    const membership = await requireMembership(user.id, data.deviceId)
    if (!membership) return { ok: false as const, code: 'NOT_MEMBER' as ErrorCode }
    const values = data.thresholds
    await prisma.threshold.upsert({
      where: { deviceId: data.deviceId },
      create: { deviceId: data.deviceId, ...values },
      update: values,
    })
    return { ok: true as const, data: values }
  })

// ---------- events ----------

export const ackEvent = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const eventId = typeof input === 'object' && input !== null && 'eventId' in input
      ? String((input as { eventId: unknown }).eventId)
      : ''
    if (!eventId) return { ok: false as const }
    return { ok: true as const, eventId }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (!user) return { ok: false as const, code: 'UNAUTH' as ErrorCode }
    if (!data.ok) return { ok: false as const, code: 'INVALID' as ErrorCode }
    const event = await prisma.event.findUnique({ where: { id: data.eventId } })
    if (!event) return { ok: false as const, code: 'NOT_FOUND' as ErrorCode }
    const membership = await requireMembership(user.id, event.deviceId)
    if (!membership) return { ok: false as const, code: 'NOT_MEMBER' as ErrorCode }
    await prisma.event.update({
      where: { id: event.id },
      data: { acknowledgedBy: user.name, acknowledgedAt: new Date() },
    })
    return { ok: true as const, data: { eventId: event.id, by: user.name } }
  })
