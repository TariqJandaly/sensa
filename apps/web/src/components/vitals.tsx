import { HeartPulse, Move3d, Thermometer, Wind, Zap, type LucideIcon } from 'lucide-react'

import { Sparkline } from './sparkline'

import { useLocale } from '#/lib/i18n/index'

export type VitalKey = 'hr' | 'spo2' | 'temp' | 'gsr' | 'motion'

const ICONS: Record<VitalKey, LucideIcon> = {
  hr: HeartPulse,
  spo2: Wind,
  temp: Thermometer,
  gsr: Zap,
  motion: Move3d,
}

const SPARK_STROKE: Record<string, string> = {
  SAFE: 'var(--safe-ink)',
  WATCH: 'var(--watch-ink)',
  ALERT: 'var(--alert-ink)',
  SOS: 'var(--alert-ink)',
}

export interface VitalCardProps {
  vital: VitalKey
  /** Formatted display value, null when the sensor has no reading. */
  value: string | null
  series: (number | null)[]
  status: string
  range: string
}

export function VitalCard({ vital, value, series, status, range }: VitalCardProps) {
  const { t } = useLocale()
  const Icon = ICONS[vital]
  const stroke = SPARK_STROKE[status] ?? 'var(--primary)'

  return (
    <div className="card-soft rounded-xl p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-ink-soft">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {t(`dash.vitals.${vital}`)}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="tnum text-3xl font-extrabold text-ink">
          {value ?? t('dash.vitals.noValue')}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-faint">{t(`dash.vitals.${vital}.unit`)}</p>
      <div className="mt-3">
        <Sparkline values={series} stroke={stroke} />
      </div>
      <p className="tnum mt-2 text-xs text-ink-faint">{range}</p>
    </div>
  )
}
