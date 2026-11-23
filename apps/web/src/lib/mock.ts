import type { EventType, ReadingInput, Thresholds } from '@sensa/contracts'
import { DEFAULT_THRESHOLDS } from '@sensa/contracts'

/**
 * Deterministic synthetic dataset for the UI-complete build.
 * The students' device has no live hardware feed yet, so every page renders
 * from this seeded generator: same numbers every load, timestamps anchored
 * to `now` and returned alongside the data so SSR and hydration agree.
 * Every surface that shows it carries the demo badge.
 */

export interface MockEvent {
  id: string
  type: EventType
  capturedAt: string
  lat?: number
  lng?: number
  acknowledgedBy?: string
  acknowledgedAt?: string
}

export interface MockMember {
  id: string
  name: string
  email: string
  role: 'WEARER' | 'CAREGIVER'
  notify: boolean
  you?: boolean
}

export interface MockDevice {
  id: string
  name: string
  status: 'ONLINE' | 'OFFLINE'
  batteryPct: number
  lastSeenAt: string
  pairingCode: string
}

export interface SensaData {
  anchor: number
  device: MockDevice
  wearer: { name: string }
  members: MockMember[]
  thresholds: Thresholds
  readings: ReadingInput[]
  events: MockEvent[]
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STEP_MS = 2 * 60 * 1000 // one reading every 2 minutes
const COUNT = 720 // 24 hours

export function buildMockDataset(anchor = Date.now()): SensaData {
  const rnd = mulberry32(1408)
  const readings: ReadingInput[] = []

  // Episode window: 3h..2h20m before now -> WATCH, then ALERT, then recovery.
  const episodeStart = anchor - 3 * 60 * 60 * 1000
  const episodePeak = anchor - 2 * 60 * 60 * 1000 - 40 * 60 * 1000
  const episodeEnd = anchor - 2 * 60 * 60 * 1000 - 10 * 60 * 1000

  for (let i = COUNT - 1; i >= 0; i--) {
    const at = anchor - i * STEP_MS
    const wobble = rnd() - 0.5

    let hr = 72 + wobble * 10
    let spo2 = 97 + wobble * 1.4
    let temp = 36.55 + wobble * 0.22
    let gsr = 238000 + wobble * 22000
    let status: ReadingInput['status'] = 'SAFE'
    const flags: string[] = []

    if (at >= episodeStart && at <= episodeEnd) {
      const phase = at <= episodePeak ? (at - episodeStart) / (episodePeak - episodeStart) : 1
      hr = 78 + phase * 54 + wobble * 6 // 78 -> 132
      spo2 = 97 - phase * 9.5 + wobble * 0.8 // 97 -> 87.5
      temp = 36.6 + phase * 1.3 + wobble * 0.1 // 36.6 -> 37.9
      gsr = 240000 * (1 + phase * 0.72) + wobble * 9000 // +72% skin response
      if (phase > 0.45) {
        status = at > episodePeak ? 'ALERT' : 'WATCH'
        if (hr >= 120) flags.push('heart rate high')
        if (spo2 <= 92) flags.push('SpO2 low')
        if (temp >= 37.8) flags.push('temperature high')
        if (at > episodeStart + 8 * 60 * 1000) flags.push('GSR signal changed')
        status = phase > 0.62 ? 'ALERT' : 'WATCH'
      } else if (phase > 0.2) {
        status = 'WATCH'
        flags.push('GSR signal changed')
      }
    }

    readings.push({
      capturedAt: new Date(at).toISOString(),
      hrBpm: Math.round(hr * 10) / 10,
      spo2Pct: Math.round(spo2 * 10) / 10,
      tempC: Math.round(temp * 100) / 100,
      gsrOhm: Math.round(gsr),
      accelX: Math.round((wobble * 0.8) * 100) / 100,
      accelY: Math.round((rnd() - 0.5) * 100) / 100,
      accelZ: Math.round((9.8 + wobble * 0.9) * 100) / 100,
      status,
      flags,
    })
  }

  // Wearer is 40 seconds fresh.
  readings[readings.length - 1] = {
    ...readings[readings.length - 1],
    capturedAt: new Date(anchor - 40 * 1000).toISOString(),
  }

  const iso = (ms: number) => new Date(ms).toISOString()

  const events: MockEvent[] = [
    {
      id: 'ev-01',
      type: 'ALERT',
      capturedAt: iso(episodePeak),
      acknowledgedBy: 'أم محمد',
      acknowledgedAt: iso(episodePeak + 3 * 60 * 1000),
    },
    {
      id: 'ev-02',
      type: 'SOS',
      capturedAt: iso(anchor - 2 * 60 * 60 * 1000 - 20 * 60 * 1000),
      lat: 21.5433,
      lng: 39.1728,
      acknowledgedBy: 'أم محمد',
      acknowledgedAt: iso(anchor - 2 * 60 * 60 * 1000 - 16 * 60 * 1000),
    },
    {
      id: 'ev-03',
      type: 'OFFLINE',
      capturedAt: iso(anchor - 16 * 60 * 60 * 1000),
    },
    {
      id: 'ev-04',
      type: 'ONLINE',
      capturedAt: iso(anchor - 16 * 60 * 60 * 1000 + 22 * 60 * 1000),
    },
    {
      id: 'ev-05',
      type: 'ALERT',
      capturedAt: iso(anchor - 9 * 60 * 60 * 1000),
      acknowledgedBy: 'أحمد',
      acknowledgedAt: iso(anchor - 9 * 60 * 60 * 1000 + 7 * 60 * 1000),
    },
  ]

  return {
    anchor,
    device: {
      id: 'dev-demo-01',
      name: 'ساعة سارة',
      status: 'ONLINE',
      batteryPct: 63,
      lastSeenAt: iso(anchor - 40 * 1000),
      pairingCode: 'K7Q2-9M4X',
    },
    wearer: { name: 'سارة' },
    members: [
      { id: 'm-01', name: 'سارة', email: 'sara@example.com', role: 'WEARER', notify: true },
      {
        id: 'm-02',
        name: 'أم محمد',
        email: 'umm@example.com',
        role: 'CAREGIVER',
        notify: true,
        you: true,
      },
      { id: 'm-03', name: 'أحمد', email: 'ahmed@example.com', role: 'CAREGIVER', notify: false },
    ],
    thresholds: { ...DEFAULT_THRESHOLDS },
    readings,
    events,
  }
}
