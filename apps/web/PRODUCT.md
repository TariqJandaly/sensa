# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated by the user: Bun-workspaces monorepo. `apps/web` is TanStack Start (Vite SSR) + Better Auth (email/password) + Prisma 7 on PostgreSQL + shadcn/ui + Tailwind 4. `packages/contracts` holds zod-validated Reading/Event/Threshold contracts shared by web and the MQTT ingest service. Docker Compose runs Postgres (127.0.0.1:5434) and Mosquitto MQTT (1883). Domain: to be purchased later; everything must run on plain HTTP locally and move to HTTPS at deploy (Web Push requires HTTPS).

## Users

Two confirmed roles, from the students' report: the **wearer** (a person with wheat allergy wearing the SENSA wrist device) and **caregivers** (family members who receive alerts and can acknowledge them). Both are Arabic-speaking (Saudi) primarily; an English toggle exists. Inferred, not confirmed: caregivers are often parents of a child wearer, checking on a phone.

## Product Purpose

SENSA is a student-built wearable that monitors the wearer's vital signs (heart rate, SpO2, skin temperature, GSR, motion) on a Raspberry Pi 4 and raises an early alert when readings look abnormal. This web app is the missing half the report asks for in its future-work chapter: it receives the device's readings over MQTT, stores them, shows live status and history, and pushes alerts to the wearer and their caregivers. Success: a caregiver sees an alert within seconds of the device raising one, and the wearer's family can review what happened.

## Positioning

The report's claimed differentiators vs. prior work: GPS + AI linkage + alerting on a *probable* reaction before symptoms. This app must present that honestly: it is an educational prototype, not a medical device, and the UI must carry that disclaimer permanently (the device code itself contains it).

## Operating Context

The Raspberry Pi publishes each reading as one JSON line (JSONL contract, fields: capturedAt, hrBpm, spo2Pct, tempC, gsrOhm, accelX/Y/Z, status, flags). The device's internet is known-unstable (report challenge #3), so ingestion must accept batched backfill with device timestamps. MQTT is the confirmed transport (user decision). Fallback alert channels (SMS/Telegram/WhatsApp) are approved for a later phase; Web Push is in scope now. The device has a manual SOS button and a GPS module (NEO-6): an SOS event carries lat/lng.

## Capabilities and Constraints

In scope for this build: Better Auth email/password sign-in, sign-up, forgot-password; live dashboard (status, vitals, sparkline history, event feed); history with export; alerts with acknowledge; caregivers management; per-device thresholds editor; demo/simulator mode driven by seeded mock data (the device code has DEMO_MODE; the team needs a live demo for the project defense); PWA manifest + service worker + Web Push subscription wiring. Out of scope now: real device provisioning flow on hardware, AI model hosting, SMS/WhatsApp fallback implementation, production MQTT credentials (dev broker is anonymous).

Hard constraint: Arabic-first RTL with an EN toggle (user decision). Visual direction pinned by the user: calm clinical light, warm off-white ground, deep teal-green primary, status colors reserved for real state (SAFE green / WATCH amber / ALERT red). iOS Web Push requires the PWA to be installed to the home screen (iOS 16.4+); the UI must teach that.

## Brand Commitments

Name: SENSA (سنسا). No logo assets exist yet. Voice: calm, plain, family-facing Arabic; no fear-marketing; errors say what to do next. The medical disclaimer text (Arabic + English) in `@sensa/contracts` must appear: onboarding gate, footer of every page.

## Evidence on Hand

The students' final report PDF (root/.hermes/attachments/تقرير المشروع النهائي.pdf, 42 pages, Arabic): sensor list, device code screenshots (thresholds, JSONL logging, DEMO_MODE, disclaimer), 104-person survey, wiring diagram. No real readings exist yet; all dashboard data in this build is labeled synthetic (بيانات تجريبية). Do not fabricate medical claims.

## Product Principles

1. Status is the product: the current state of the wearer must be legible from across a room, in one glance.
2. Color means truth: green/amber/red appear only for real reading states, never as decoration.
3. Alerting beats monitoring: an unacknowledged alert keeps speaking until a human answers.
4. Arabic is the first language, not a translation layer; RTL is the primary layout, EN is the toggle.
5. An educational prototype that behaves like a medical device in polish, and never claims to be one.

## Accessibility & Inclusion

WCAG 2.2 AA target. Status is never color-only: every state carries an Arabic word + icon. Touch targets ≥ 44px on mobile. prefers-reduced-motion disables the breathing status animation. Contrast ≥ 4.5:1 for body text on the warm ground.
