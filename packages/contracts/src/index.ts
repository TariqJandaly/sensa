/**
 * SENSA shared contracts.
 *
 * One source of truth for the shape of a device Reading, Events, thresholds
 * and their validation. Used by the web app (server + UI) and by the MQTT
 * ingest service, so the Pi payload, the API and the database can never drift.
 *
 * Field names follow the students' existing device prototype code:
 * heart rate (MAX30102), SpO2, body temperature (MLX90614), GSR (ADS1115),
 * motion (MPU6050), plus a computed status and flags list.
 */
import { z } from 'zod'

// ---------- Enums (strings, never Prisma enums) ----------

export const READING_STATUSES = ['SAFE', 'WATCH', 'ALERT'] as const
export type ReadingStatus = (typeof READING_STATUSES)[number]

export const EVENT_TYPES = ['ALERT', 'SOS', 'ONLINE', 'OFFLINE'] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const MEMBER_ROLES = ['WEARER', 'CAREGIVER'] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

export const DEVICE_STATUSES = ['OFFLINE', 'ONLINE'] as const
export type DeviceStatus = (typeof DEVICE_STATUSES)[number]

// ---------- Thresholds (mirrors the device sensa_config) ----------

export const DEFAULT_THRESHOLDS = {
  tempHighC: 37.8,
  hrLowBpm: 50,
  hrHighBpm: 120,
  spo2LowPct: 92,
  gsrChangeThreshold: 0.15,
  motionDeltaThreshold: 2.5,
} as const

export type Thresholds = {
  tempHighC: number
  hrLowBpm: number
  hrHighBpm: number
  spo2LowPct: number
  gsrChangeThreshold: number
  motionDeltaThreshold: number
}

export const thresholdsSchema = z.object({
  tempHighC: z.number().min(34).max(43),
  hrLowBpm: z.number().min(30).max(90),
  hrHighBpm: z.number().min(90).max(220),
  spo2LowPct: z.number().min(70).max(100),
  gsrChangeThreshold: z.number().min(0.01).max(2),
  motionDeltaThreshold: z.number().min(0.1).max(20),
})

// ---------- Reading (one JSONL line from the device) ----------

const optionalSensorNumber = (
  min: number,
  max: number,
  label: string,
): z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodNumber>>> =>
  z
    .number()
    .min(min, `${label} out of range`)
    .max(max, `${label} out of range`)
    .nullable()
    .optional()
    .default(null)

export const readingSchema = z.object({
  /** Device clock timestamp, ISO 8601. Device buffers offline and backfills. */
  capturedAt: z.iso.datetime({ offset: true }),
  hrBpm: optionalSensorNumber(0, 300, 'Heart rate'),
  spo2Pct: optionalSensorNumber(0, 100, 'SpO2'),
  tempC: optionalSensorNumber(20, 45, 'Temperature'),
  gsrOhm: optionalSensorNumber(0, 10_000_000, 'GSR'),
  accelX: optionalSensorNumber(-16, 16, 'Accel X'),
  accelY: optionalSensorNumber(-16, 16, 'Accel Y'),
  accelZ: optionalSensorNumber(-16, 16, 'Accel Z'),
  status: z.enum(READING_STATUSES).default('SAFE'),
  flags: z.array(z.string().max(120)).max(16).default([]),
})

export type ReadingInput = z.infer<typeof readingSchema>

// ---------- Transport payloads ----------

export const readingBatchSchema = z.object({
  deviceId: z.string().min(1),
  readings: z.array(readingSchema).min(1).max(1000),
})
export type ReadingBatch = z.infer<typeof readingBatchSchema>

export const sosEventSchema = z.object({
  capturedAt: z.iso.datetime({ offset: true }),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})
export type SosEventInput = z.infer<typeof sosEventSchema>

export const heartbeatSchema = z.object({
  ts: z.iso.datetime({ offset: true }),
  batteryPct: z.number().min(0).max(100).nullable().optional(),
})
export type HeartbeatInput = z.infer<typeof heartbeatSchema>

// ---------- Server-side threshold evaluation ----------
//
// The device computes its own status, but the server re-evaluates every
// reading so it stays the source of truth for alerts and history.

export function evaluateReading(
  reading: ReadingInput,
  thresholds: Thresholds,
  gsrBaselineOhm: number | null,
): { status: ReadingStatus; flags: string[] } {
  const flags: string[] = []

  if (reading.tempC != null && reading.tempC >= thresholds.tempHighC) {
    flags.push('temperature high')
  }
  if (reading.hrBpm != null && reading.hrBpm <= thresholds.hrLowBpm) {
    flags.push('heart rate low')
  }
  if (reading.hrBpm != null && reading.hrBpm >= thresholds.hrHighBpm) {
    flags.push('heart rate high')
  }
  if (reading.spo2Pct != null && reading.spo2Pct <= thresholds.spo2LowPct) {
    flags.push('SpO2 low')
  }

  let baseline = gsrBaselineOhm
  if (reading.gsrOhm != null && baseline != null) {
    const delta = Math.abs(reading.gsrOhm - baseline) / Math.max(baseline, 1)
    if (delta >= thresholds.gsrChangeThreshold) {
      flags.push('GSR signal changed')
    }
    baseline = 0.95 * baseline + 0.05 * reading.gsrOhm
  } else if (reading.gsrOhm != null) {
    baseline = reading.gsrOhm
  }

  const accel = [reading.accelX, reading.accelY, reading.accelZ]
  if (accel.every((v) => v != null)) {
    const magnitude = Math.sqrt(accel.reduce((sum, v) => sum + (v as number) ** 2, 0))
    flags.push(`motion magnitude ${magnitude.toFixed(2)}`)
  }

  const hardFlags = flags.filter((f) => !f.startsWith('motion'))
  const status: ReadingStatus =
    hardFlags.length >= 2 ? 'ALERT' : hardFlags.length === 1 ? 'WATCH' : 'SAFE'

  return { status, flags }
}

export const DISCLAIMER_AR =
  'سنسا نموذج تعليمي أولي وليس جهازاً طبياً. لا يشخّص حساسية القمح ولا يستبعد حدوثها ولا يتنبأ بها بشكل موثوق. لا يُستخدم لاتخاذ قرار تناول طعام أو تأخير طلب الرعاية الطبية. عند ظهور أعراض حساسية استخدم أدوية الطوارئ الموصوفة واطلب المساعدة الطبية فوراً.'
export const DISCLAIMER_EN =
  'SENSA is an educational prototype, not a medical device. It cannot diagnose, rule out, or reliably predict wheat allergy or anaphylaxis. Do not use it to decide whether to eat a food or delay emergency treatment. If allergy symptoms appear, use your prescribed emergency medication and seek medical help immediately.'
