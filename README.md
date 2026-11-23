# SENSA (سنسا)

The web and server half of the SENSA wheat-allergy early-alert wearable. The
watch measures the wearer's vitals, sends the readings over MQTT, and this
monorepo receives them, stores them, shows live status and history, and
pushes alerts to the wearer and their caregivers.

> سنسا نموذج تعليمي وليست جهازاً طبياً. This is an educational prototype,
> not a medical device. The disclaimer ships on every page of the app and you
> should keep it on anything you build from this.

## What is in this repo

```
apps/
  web/        the site: TanStack Start + Better Auth + Prisma 7 + shadcn/ui.
              Arabic-first RTL with an English toggle, PWA, Web Push.
              All pages read and write through server functions in
              src/functions/devices.ts.
  ingest/     the MQTT bridge. Subscribes to the broker, validates every
              payload against the shared schemas, forwards to the web API
              with the device's token.
  device-sim/ a Raspberry Pi simulator. Publishes the same batches, heartbeats
              and SOS messages a real watch would, so you can run the whole
              chain without hardware.
packages/
  contracts/  the shared source of truth: Reading, Event and Threshold
              schemas (zod) plus evaluateReading(), the threshold evaluator.
              The web app, the bridge and the Pi code all speak this shape.
deploy/
  mosquitto/  dev broker config. Anonymous on purpose for local runs.
              Production needs per-device credentials and TLS.
docker-compose.yml   Postgres 17 (127.0.0.1:5434) + Mosquitto (1883)
docs/
  ARCHITECTURE.md   how the whole system works, end to end
  DEVICE-GUIDE.md   how to link a device to an account, payloads, testing
  PI-WIRING.md      how to wire the students' Pi prototype code to the server
```

## Quickstart

You need Bun 1.4 or newer, Docker, and about five minutes.

```bash
docker compose up -d                 # postgres + mosquitto
bun install                          # installs all workspaces
cd apps/web
cp .env.local.example .env.local    # fill BETTER_AUTH_SECRET and the
                                     # DATABASE_URL, see the file itself
bun run db:migrate -- --name init   # creates the tables
bunx vite dev --port 3123 --host    # http://localhost:3123
```

Open the app, create an account, then go to the setup page (ربط الجهاز) and
create a demo device. The page shows you a one-time device token and the
exact command to run the simulator. With the bridge and the simulator
running in two more terminals the dashboard goes live: fresh readings, the
battery draining, one WATCH, ALERT, SOS episode every cycle, and a push
notification when the alert fires.

The full recipe with all three commands is in
[docs/DEVICE-GUIDE.md](docs/DEVICE-GUIDE.md).

## The MQTT contract in one table

The watch publishes to the broker, QoS 1. The bridge does the rest.

| Topic | Payload |
|---|---|
| `sensa/<deviceId>/readings` | `{"deviceId":"...","readings":[{"capturedAt":"2026-11-23T17:15:00Z","hrBpm":74,"spo2Pct":97,"tempC":36.6,"gsrOhm":240000,"accelX":0.1,"accelY":0.05,"accelZ":9.8,"status":"SAFE","flags":[]}]}` up to 1000 per batch |
| `sensa/<deviceId>/sos` | `{"capturedAt":"...","lat":21.5433,"lng":39.1728}` |
| `sensa/<deviceId>/heartbeat` | `{"ts":"...","batteryPct":63}` |

Field names are not suggestions. They are validated by zod schemas in
`packages/contracts/src/index.ts`, and anything that fails validation is
dropped with a log line in the bridge. The Pi buffers readings while its wifi
is down and sends them later with their original `capturedAt`, so the
history stays truthful even when the watch goes quiet.

## Where to read next

- How a reading travels from the wrist to a caregiver's phone, how the alert
  engine decides, how auth works for people and devices:
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Creating a device, pairing codes, caregiver accounts, payload rules,
  testing with the simulator, troubleshooting:
  [docs/DEVICE-GUIDE.md](docs/DEVICE-GUIDE.md)
- The actual Python for the students' existing `sensa.py` prototype, with
  the exact places to hook in buffering, heartbeat and the SOS button:
  [docs/PI-WIRING.md](docs/PI-WIRING.md)

## Status of the build

Done and verified by real runs: the full UI in both languages, Better Auth
sessions, device provisioning, the ingest API with token auth and rate
limits, the alert engine with cooldown dedup, Web Push delivered to a real
browser, and the simulator chain end to end.

Not built yet, by decision:

- SMS, Telegram and WhatsApp fallbacks for alerts. The fan-out function in
  `apps/web/src/lib/alerts.server.ts` is the single place to add them.
- Production broker hardening: per-device credentials and TLS on 8883.
- Deployment: the domain, HTTPS, `TRUSTED_ORIGINS`, `prisma migrate deploy`,
  and a small Node adapter, because the production build is a fetch handler
  and not a runnable server.

## Ports on this host

dev server 3123 (0.0.0.0), postgres 127.0.0.1:5434, mosquitto 1883.
