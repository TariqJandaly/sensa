# DESIGN — SENSA web

Direction chosen by the user (calm clinical light, Arabic-first RTL) and
built code-first; this file records the world that shipped.

## Palette

| Role | Value | Use |
|---|---|---|
| ground | `#f5f2ea` | page ground, warm off-white |
| surface / surface-2 | `#ffffff` / `#faf8f1` | cards, rail |
| ink / ink-soft / ink-faint | `#1e2b26` / `#5b685f` / `#939c92` | text tiers |
| line / line-strong | `#e5e0d1` / `#cfc9b6` | hairlines, rules |
| primary / strong / tint | `#0e6653` / `#0a4f41` / `#e2efe9` | actions, links, focus, active nav |
| primary-ink | `#f7f4ed` | on primary |

Status colors appear **only** as real reading state, always with a word and
an icon, never color alone:

| State | ink | tint |
|---|---|---|
| SAFE | `#14683f` | `#e8f2e8` |
| WATCH | `#8a5a00` | `#f9f0d7` |
| ALERT / SOS | `#b3261e` | `#fbe9e4` |

Contrast measured on the shipped build: ink/ground 13.14:1, ink-soft/ground
8.50:1, SAFE word on tint 5.94:1 (WCAG AA pass).

## Type

Almarai (self-hosted, `public/fonts/`, arabic + latin subsets), weights
300/400/700/800. Body 16px, line-height 1.6. Every measurement uses
`font-variant-numeric: tabular-nums` (`.tnum`). Arabic locale tags:
`ar-SA-u-ca-gregory` for dates, `ar-SA-u-nu-latn` for numbers.

## The signature move

The **breathing status ring**: an SVG ring around the wearer's initial whose
halo breathes at 3.4s when SAFE, 0.9s at ALERT/SOS, still under
`prefers-reduced-motion`. It is the single authority for "how is the wearer
right now"; the hero band ground tints with the same state. No other element
animates.

## Layout

- Desktop: start-side (right in RTL) rail, 240px, `bg-surface-2`, hairline
  `border-e`; active nav item = `bg-primary-tint` + `text-primary-strong`.
- Mobile (<md): sticky top bar (brand + lang toggle) + fixed 6-item bottom
  tab bar with `env(safe-area-inset-bottom)` padding.
- Content column `max-w-5xl`; spacing on an 8px rhythm; more space above a
  heading than below; cards `rounded-2xl` + `--shadow-soft` (offset + blur).

## Components

shadcn primitives restyled by the tokens above; custom: StatusRing,
StatusWord/EventIcon/DemoBadge/BatteryChip, Sparkline, VitalCard,
TimelineChart (hand-drawn SVG, HR/SpO2/temp series + ALERT markers,
`vector-effect="non-scaling-stroke"`), DisclaimerFooter (on every page),
LangToggle (endonym label), demo simulator.

## Rules

- No kicker/eyebrow labels. Headings carry their own weight.
- No thick colored border-left/right on status rows: tint + word + icon.
- Charts flow left-to-right even in RTL (`dir="ltr"` on the chart block);
  timestamps render RTL text.
- Demo data is labeled everywhere it appears (`بيانات تجريبية`).
- The medical disclaimer renders on every surface: landing block, auth quiet
  panel, app footer.
- Focus: 2px `--primary` outline, offset 2. Selection/scrollbar/caret themed
  from the palette.
