/**
 * SENSA Raspberry Pi simulator (Bun).
 *
 * Publishes exactly what the students' watch code would publish: batches of
 * readings over MQTT (with heartbeat and one SOS per demo cycle), so the
 * full chain runs end to end without hardware:
 *
 *   sim -> mosquitto -> ingest bridge -> /api/ingest/readings -> Postgres
 *       -> dashboard live data -> ALERT/SOS fan-out to Web Push
 *
 * Usage:
 *   bun run start --device <deviceId> --token <deviceToken> \
 *                 [--url mqtt://localhost:1883] [--scenario demo|safe] \
 *                 [--interval 5000]
 *
 * The device id + token come from the setup page when you create a
 * (demo) device.
 */
import mqtt from 'mqtt'
import type { ReadingInput } from '@sensa/contracts'

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const deviceId = arg('device')
const token = arg('token')
const brokerUrl = arg('url', 'mqtt://localhost:1883')
const scenario = arg('scenario', 'demo')
const intervalMs = Number(arg('interval', '5000'))

if (!deviceId || !token) {
  console.error('usage: bun run start --device <id> --token <token> [--scenario demo|safe] [--interval 5000]')
  process.exit(1)
}

const client = mqtt.connect(brokerUrl)

const PROFILES = {
  safe: { hr: [68, 78], spo2: [96, 98], temp: [36.4, 36.8], gsrK: [225, 255] },
  watch: { hr: [92, 108], spo2: [93, 96], temp: [36.9, 37.4], gsrK: [270, 330] },
  alert: { hr: [120, 136], spo2: [85, 91], temp: [37.6, 38.2], gsrK: [380, 440] },
} as const

function rand(range: readonly [number, number]): number {
  return range[0] + Math.random() * (range[1] - range[0])
}

/** demo cycle: 4 min safe, 1 min watch, 1 min alert, SOS, 1 min recovery */
function phaseAt(tick: number): 'safe' | 'watch' | 'alert' | 'recover' | 'sos' {
  const cycle = (12 * 60) / (intervalMs / 1000) // one 12-minute cycle
  const at = tick % cycle
  const perMin = 60 / (intervalMs / 1000)
  if (at < 4 * perMin) return 'safe'
  if (at < 5 * perMin) return 'watch'
  if (at < 6 * perMin - 2) return 'alert'
  if (at < 6 * perMin) return 'sos'
  return 'recover'
}

function readingFor(phase: string, at: Date): ReadingInput {
  const profile =
    phase === 'watch' ? PROFILES.watch : phase === 'alert' || phase === 'sos' ? PROFILES.alert : PROFILES.safe
  return {
    capturedAt: at.toISOString(),
    hrBpm: Math.round(rand(profile.hr) * 10) / 10,
    spo2Pct: Math.round(rand(profile.spo2) * 10) / 10,
    tempC: Math.round(rand(profile.temp) * 100) / 100,
    gsrOhm: Math.round(rand(profile.gsrK) * 1000),
    accelX: Math.round(rand([-0.4, 0.4]) * 100) / 100,
    accelY: Math.round(rand([-0.4, 0.4]) * 100) / 100,
    accelZ: 9.8,
    status: phase === 'alert' || phase === 'sos' ? 'ALERT' : phase === 'watch' ? 'WATCH' : 'SAFE',
    flags: phase === 'safe' ? [] : ['GSR signal changed', phase === 'watch' ? '' : 'heart rate high'].filter(Boolean),
  }
}

let buffer: ReadingInput[] = []
let tick = 0
let battery = 100
let sosSentThisCycle = false

function flush() {
  if (buffer.length === 0) return
  const payload = JSON.stringify({ deviceId, readings: buffer })
  client.publish(`sensa/${deviceId}/readings`, payload, { qos: 1 })
  console.log(`[sim] ${buffer.length} readings -> sensa/${deviceId}/readings`)
  buffer = []
}

client.on('connect', () => {
  console.log(`[sim] connected ${brokerUrl}; device ${deviceId}; scenario ${scenario}`)
  client.publish(
    `sensa/${deviceId}/heartbeat`,
    JSON.stringify({ ts: new Date().toISOString(), batteryPct: battery }),
    { qos: 1 },
  )

  setInterval(() => {
    const at = new Date()
    const phase = scenario === 'safe' ? 'safe' : phaseAt(tick)
    buffer.push(readingFor(phase, at))

    if (phase === 'sos' && !sosSentThisCycle) {
      client.publish(
        `sensa/${deviceId}/sos`,
        JSON.stringify({
          capturedAt: at.toISOString(),
          lat: 21.5433 + rand([-0.01, 0.01]),
          lng: 39.1728 + rand([-0.01, 0.01]),
        }),
        { qos: 1 },
      )
      console.log('[sim] SOS published')
      sosSentThisCycle = true
    }
    if (phase === 'safe' && sosSentThisCycle) sosSentThisCycle = false

    // batch every 6 readings
    if (buffer.length >= 6) flush()
    tick++
  }, intervalMs)

  // heartbeat every 30 seconds; battery drains slowly
  setInterval(() => {
    battery = Math.max(5, battery - 0.2)
    client.publish(
      `sensa/${deviceId}/heartbeat`,
      JSON.stringify({ ts: new Date().toISOString(), batteryPct: Math.round(battery) }),
      { qos: 1 },
    )
  }, 30_000)
})

client.on('error', (err) => {
  console.error('[sim] mqtt error:', err.message)
  process.exit(1)
})
