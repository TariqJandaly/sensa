/**
 * SENSA MQTT ingest bridge (Bun).
 *
 * Subscribes to the broker, validates every payload against the shared
 * contracts, and forwards to the web app's ingest API with the device's
 * token. The Pi buffers readings offline and publishes them as batches
 * carrying their original capturedAt timestamps, so nothing is lost when
 * the watch's wifi drops (report challenge #3).
 *
 * Device tokens are per-device. Provide them as JSON in DEVICE_TOKENS:
 *   DEVICE_TOKENS='{"<deviceId>":"<token>"}' bun run start
 * or point DEVICE_TOKENS_FILE at a JSON file.
 *
 * Topics (QoS 1):
 *   sensa/<deviceId>/readings   -> batch of Reading JSON lines
 *   sensa/<deviceId>/sos        -> { capturedAt, lat, lng }
 *   sensa/<deviceId>/heartbeat  -> { ts, batteryPct? }
 */
import { readFileSync } from 'node:fs'
import mqtt from 'mqtt'
import {
  readingBatchSchema,
  sosEventSchema,
  heartbeatSchema,
} from '@sensa/contracts'

const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883'
const API_URL = process.env.SENSAA_API_URL // e.g. http://localhost:3123

function loadTokenMap(): Record<string, string> {
  const raw = process.env.DEVICE_TOKENS_FILE
    ? readFileSync(process.env.DEVICE_TOKENS_FILE, 'utf-8')
    : (process.env.DEVICE_TOKENS ?? '{}')
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    console.log('[ingest] token map loaded for', Object.keys(parsed).length, 'device(s)')
    return parsed
  } catch {
    console.error('[ingest] DEVICE_TOKENS is not valid JSON')
    return {}
  }
}

const tokenMap = loadTokenMap()
const client = mqtt.connect(MQTT_URL)

client.on('connect', () => {
  console.log('[ingest] connected to', MQTT_URL)
  client.subscribe(
    ['sensa/+/readings', 'sensa/+/sos', 'sensa/+/heartbeat'],
    { qos: 1 },
    (err) => {
      if (err) {
        console.error('[ingest] subscribe failed:', err.message)
      } else {
        console.log('[ingest] subscribed to sensa/+/readings|sos|heartbeat')
      }
    },
  )
})

client.on('error', (err) => {
  console.error('[ingest] mqtt error:', err.message)
})

async function forward(path: string, deviceId: string, body: unknown) {
  if (!API_URL) return
  const token = tokenMap[deviceId]
  if (!token) {
    console.warn('[ingest] no token for device', deviceId, '- dropping')
    return
  }
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sensa-device-token': token,
      },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { alertsRaised?: number }
      if (data.alertsRaised) {
        console.log('[ingest] alert raised on', deviceId)
      }
    } else {
      console.error(
        '[ingest] forward failed:',
        path,
        res.status,
        await res.text().catch(() => ''),
      )
    }
  } catch (err) {
    console.error('[ingest] forward error:', path, (err as Error).message)
  }
}

client.on('message', (topic, payload) => {
  const parts = topic.split('/')
  if (parts.length !== 3 || parts[0] !== 'sensa') return
  const deviceId = parts[1]
  const kind = parts[2]

  let parsed: unknown
  try {
    parsed = JSON.parse(payload.toString('utf-8'))
  } catch {
    console.warn('[ingest] non-JSON payload on', topic)
    return
  }

  if (kind === 'readings') {
    const check = readingBatchSchema.safeParse({ deviceId, ...parsedAsRecord(parsed) })
    if (!check.success) {
      console.warn('[ingest] invalid readings batch:', check.error.issues[0]?.message)
      return
    }
    console.log(
      `[ingest] device ${deviceId}: ${check.data.readings.length} readings ` +
        `(${check.data.readings[0].capturedAt} .. ${check.data.readings.at(-1)?.capturedAt})`,
    )
    void forward('/api/ingest/readings', deviceId, check.data)
  } else if (kind === 'sos') {
    const check = sosEventSchema.safeParse(parsed)
    if (!check.success) {
      console.warn('[ingest] invalid sos payload:', check.error.issues[0]?.message)
      return
    }
    console.log(`[ingest] device ${deviceId}: SOS at ${check.data.lat},${check.data.lng}`)
    void forward('/api/ingest/sos', deviceId, { deviceId, ...check.data })
  } else if (kind === 'heartbeat') {
    const check = heartbeatSchema.safeParse(parsed)
    if (!check.success) {
      console.warn('[ingest] invalid heartbeat:', check.error.issues[0]?.message)
      return
    }
    console.log(`[ingest] device ${deviceId}: heartbeat`)
    void forward('/api/ingest/heartbeat', deviceId, { deviceId, ...check.data })
  }
})

function parsedAsRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}
