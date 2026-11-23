# How SENSA works

This document walks the whole system: what each piece does, how a reading
travels from the wrist to a caregiver's phone, and where the decisions are
made. Read it once and the codebase will have no surprises for you.

## The short version

The watch measures, the server decides, the family gets told. The watch is
allowed to be optimistic: it flags its own readings and sounds its own
buzzer. But the server re-evaluates every reading with the device's saved
thresholds, so the alert history in the database is the version that counts.

## The path of a reading

```
 Raspberry Pi 4 on the wrist
   sensors -> Reading dict -> local JSONL log (unchanged)
                        |
                        |  buffered, batched
                        v
 Mosquitto broker   sensa/<deviceId>/readings        (QoS 1)
                        |
                        v
 apps/ingest  (Bun bridge)
   validates with @sensa/contracts zod schemas
   looks up the device token
                        |
                        v
 POST /api/ingest/readings  +  x-sensa-device-token header
                        |
                        v
 apps/web
   verify token (sha256, constant time)
   re-evaluate with the device's thresholds
   INSERT readings, update device status
   on escalation: create one ALERT event (5 min cooldown)
                        |
                        v
 fan-out: every member with notifications on
   Web Push (VAPID) -> phone notification, Arabic or English
                        |
                        v
 dashboard, history, alerts page   reading from Postgres
```

Step by step:

1. The watch collects a reading every `SAMPLE_INTERVAL_SECONDS` and keeps
   doing what the students' prototype already did: writes one JSON line to
   its local log, shows it on the OLED, vibrates on its own alert.
2. A publisher thread batches readings (the default is 6 per batch) and
   publishes to `sensa/<deviceId>/readings`. If wifi is down the batch waits
   in memory and goes out later, still carrying the original `capturedAt`.
3. The bridge in `apps/ingest` subscribes to `sensa/+/readings|sos|heartbeat`,
   parses and validates each payload, and forwards it to the web API with
   the device's token in the `x-sensa-device-token` header.
4. The ingest routes in `apps/web/src/routes/api/ingest/` check the token
   against the stored hash, check the batch against the zod schema, and rate
   limit per device (120 batches per minute).
5. `alerts.server.ts` re-evaluates every reading with `evaluateReading()`
   from the shared contracts and the device's saved thresholds, stores the
   readings, and marks the device ONLINE.
6. If the last reading in a batch is ALERT and no ALERT event exists in the
   last 5 minutes, one ALERT event is created and pushed. A whole shaky
   minute produces one event and one notification, not forty.
7. Push goes to every device member whose notify switch is on. Dead
   subscriptions (phone uninstalled the app, endpoint gone) are pruned
   automatically.
8. When someone opens the dashboard or the alerts page, the loaders call
   `getAppData()`, which reads the window of recent readings, the events,
   the members and the thresholds, and checks whether the device has gone
   quiet: no heartbeat for 90 seconds flips it OFFLINE and records an
   OFFLINE event.

## The pieces

### apps/web

One TanStack Start app. It is both the UI and the API:

- `src/routes/` the pages. Auth pages, the app shell, dashboard, history,
  alerts, caregivers, settings, setup, and the API routes under
  `src/routes/api/`.
- `src/functions/devices.ts` every user-authenticated read and write the UI
  needs: `getAppData`, `getHistoryData`, `createDevice`, `createDemoDevice`,
  `joinDevice`, `addCaregiver`, `setMemberNotify`, `removeMember`,
  `updateThresholds`, `ackEvent`. Each one resolves the session from the
  request, checks membership, then talks to Prisma.
- `src/lib/alerts.server.ts` the ingest handlers' brain: token lookup,
  threshold evaluation, event dedup, the OFFLINE sweep, push fan-out.
- `src/lib/push.server.ts` VAPID setup and one `sendPush()` helper.
- `src/lib/i18n/` the Arabic and English dictionaries. Arabic is the
  default; the toggle writes a cookie and the server reads it so even the
  first render comes out in the right language.

### apps/ingest

Deliberately dumb. It knows the topics, the schemas and the token map, and
nothing about the database. This keeps the trust boundary in one place: the
web API is the only thing that touches Postgres. The token map is passed as
`DEVICE_TOKENS` (inline JSON) or `DEVICE_TOKENS_FILE` (path), so tokens never
sit in the repo.

### apps/device-sim

The stand-in for the watch. Same topics, same payloads, one 12 minute cycle:
4 minutes stable, 1 minute rising heart rate, 1 minute falling oxygen with
one SOS, then recovery. Heartbeats every 30 seconds with a slowly draining
battery. Use it for demos and for testing the alert engine without
hardware.

### packages/contracts

The one file everyone agrees on (`src/index.ts`):

- `readingBatchSchema`, `sosEventSchema`, `heartbeatSchema`: what the wire
  accepts.
- `thresholdsSchema` with sane bounds, used by both the ingest routes and
  the settings page.
- `evaluateReading()`: the same threshold math runs on the device (if the
  students adopt it) and on the server, so there is one definition of
  "abnormal".
- `DEFAULT_THRESHOLDS`: 37.8 C, 50 to 120 bpm, SpO2 92, GSR change 0.15,
  motion delta 2.5. These mirror the students' `sensa_config`.

When the Pi code and the server disagree about a field name, the contracts
file wins. It is the referee.

## Two kinds of authentication

People and devices get different credentials, because they fail in
different ways.

- A person logs in with email and password through Better Auth and gets an
  httpOnly session cookie. Every page and mutation goes through a session
  check, and every device action additionally checks membership.
- A device gets a random 43 character token at provisioning. The page shows
  it exactly once. What is stored is its sha256 hash, and verification is
  constant time. If a token leaks, you delete the device and provision a new
  one; nothing about the user account is exposed.

Caregivers never get the device token. They join with the pairing code
(`XXXX-XXXX`, generated without lookalike characters) and get read access
plus notifications. The wearer is whoever created the device, and the
wearer row cannot be removed.

## The alert engine, precisely

Every reading that arrives goes through `evaluateReading(reading, thresholds,
gsrBaseline)`. It flags:

- temperature at or above `tempHighC`
- heart rate at or below `hrLowBpm` or at or above `hrHighBpm`
- SpO2 at or below `spo2LowPct`
- a GSR jump of `gsrChangeThreshold` relative to a slow-moving baseline
  (the baseline adapts at 0.95 old + 0.05 new)

Two or more hard flags is ALERT, one is WATCH, otherwise SAFE. The reading
keeps the server's verdict even if the watch disagreed.

Events are deduplicated on a 5 minute cooldown per device. SOS is never
deduplicated: the emergency button always produces an event, immediately,
with coordinates.

The OFFLINE sweep runs lazily when data is read, not on a timer, which keeps
the dev setup simple: if the last heartbeat is older than 90 seconds, the
device flips OFFLINE and an OFFLINE event records when the feed went quiet.

## The push pipeline

1. A caregiver taps enable notifications in settings.
2. The browser fetches the VAPID public key from `/api/push/vapid`, asks
   permission, subscribes through the service worker, and POSTs the
   subscription to `/api/push/subscribe`, which stores it against their
   user id.
3. On ALERT or SOS, `fanOut()` loads every member with notifications on,
   their subscriptions, and sends each a small JSON payload: a title, a body
   built from the flags in the member's own language, and a URL.
4. The service worker shows the notification and tells any open tab, so a
   dashboard that is already open can react without a reload.

Two honest limitations worth repeating to the team: notifications on the
iPhone only work when the site is installed to the home screen from Safari
(iOS 16.4 or newer), and browsers only allow push on HTTPS (localhost is
exempt). The domain is the last blocker for real phone testing.

## The database in one page

| Table | What it holds |
|---|---|
| `User`, `Session`, `Account`, `Verification` | Better Auth's own tables. `User.locale` is ours (ar or en). |
| `Device` | name, owner, `tokenHash`, `pairingCode`, status, battery, `isDemo` |
| `DeviceMember` | who sees this device: WEARER or CAREGIVER, plus the notify switch |
| `Reading` | one row per reading, indexed by device and captured time |
| `Event` | ALERT, SOS, ONLINE, OFFLINE, with coordinates and who acknowledged |
| `Threshold` | the six numbers per device, editable from settings |
| `PushSubscription` | one browser, keyed by endpoint, pruned when it dies |

Deleting a user cascades everything they own, so test accounts clean up in
one statement.

## Conventions worth keeping

- Colors mean state, nothing else. Green, amber and red appear only for
  real statuses, always with a word and an icon next to them.
- Demo data is labeled everywhere it appears. If the device row is
  `isDemo`, the badge shows. Trust is the product.
- The disclaimer stays on every surface. It is also baked into the
  simulator and the docs on purpose.
- All validation lives in `packages/contracts`. If you add a field, add it
  there first, then let the three consumers pick it up.
