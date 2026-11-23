import type { ReadingInput } from '@sensa/contracts'

import { useLocale } from '#/lib/i18n/index'
import { formatClock } from '#/lib/format'

const W = 800
const PAD_X = 6
const PAD_Y = 12

interface SeriesDef {
  key: 'hrBpm' | 'spo2Pct' | 'tempC'
  color: string
  width: number
  range: [number, number]
  labelKey: string
}

const SERIES: SeriesDef[] = [
  { key: 'hrBpm', color: 'var(--primary)', width: 2, range: [45, 140], labelKey: 'dash.vitals.hr' },
  { key: 'spo2Pct', color: '#8fb3a5', width: 1.5, range: [82, 100], labelKey: 'dash.vitals.spo2' },
  { key: 'tempC', color: '#c99b3f', width: 1.5, range: [36, 39], labelKey: 'dash.vitals.temp' },
]

function pointsFor(readings: ReadingInput[], def: SeriesDef, height: number): string {
  const n = readings.length
  if (n < 2) return ''
  const stepX = (W - PAD_X * 2) / (n - 1)
  const [min, max] = def.range
  const y = (v: number) =>
    height - PAD_Y - ((Math.min(Math.max(v, min), max) - min) / (max - min)) * (height - PAD_Y * 2)
  let path = ''
  let open = false
  readings.forEach((r, i) => {
    const v = r[def.key]
    if (v == null) {
      open = false
      return
    }
    path += `${open ? 'L' : 'M'}${(PAD_X + i * stepX).toFixed(1)},${y(v).toFixed(1)} `
    open = true
  })
  return path
}

/** Last-hour vitals timeline, hand-drawn SVG, alert moments marked. */
export function TimelineChart({
  readings,
  height = 220,
}: {
  readings: ReadingInput[]
  height?: number
}) {
  const { t, locale } = useLocale()
  const first = readings[0]?.capturedAt
  const last = readings[readings.length - 1]?.capturedAt

  const alertX: number[] = []
  if (readings.length > 1) {
    const stepX = (W - PAD_X * 2) / (readings.length - 1)
    readings.forEach((r, i) => {
      if (r.status === 'ALERT') {
        alertX.push(PAD_X + i * stepX)
      }
    })
  }

  return (
    <div dir="ltr">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-3">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-soft">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            {t(s.labelKey)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-soft">
          <span
            className="inline-block h-3 w-px"
            style={{ background: 'var(--alert-ink)' }}
            aria-hidden="true"
          />
          {t('status.alert')}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
        role="img"
        aria-label={t('history.title')}
      >
        <line x1="0" y1={height - 0.5} x2={W} y2={height - 0.5} stroke="var(--line-strong)" strokeWidth="1" />
        {alertX.map((x) => (
          <line
            key={x}
            x1={x}
            y1={PAD_Y}
            x2={x}
            y2={height - PAD_Y}
            stroke="var(--alert-ink)"
            strokeWidth="1"
            opacity="0.35"
          />
        ))}
        {SERIES.map((s) => (
          <path
            key={s.key}
            d={pointsFor(readings, s, height)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {first && last ? (
        <div className="flex justify-between pt-1.5 text-xs text-ink-faint">
          <span className="tnum">{formatClock(first, locale)}</span>
          <span className="tnum">{formatClock(last, locale)}</span>
        </div>
      ) : null}
    </div>
  )
}
