import {
  BatteryMedium,
  BellRing,
  FlaskConical,
  Siren,
  Wifi,
  WifiOff,
} from 'lucide-react'

import type { EventType, ReadingStatus } from '@sensa/contracts'

import { useLocale } from '#/lib/i18n/index'

const TINT: Record<string, string> = {
  SAFE: 'bg-safe-tint text-safe-ink',
  WATCH: 'bg-watch-tint text-watch-ink',
  ALERT: 'bg-alert-tint text-alert-ink',
  SOS: 'bg-alert-tint text-alert-ink',
}

/** Status is never color alone: word + dot, tinted by real state. */
export function StatusWord({ status }: { status: ReadingStatus | 'SOS' }) {
  const { t } = useLocale()
  const key = status === 'SOS' ? 'status.sos' : `status.${status.toLowerCase()}`
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${TINT[status] ?? 'bg-muted text-ink-soft'}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
      {t(key)}
    </span>
  )
}

export function EventIcon({ type }: { type: EventType }) {
  switch (type) {
    case 'SOS':
      return <Siren className="h-5 w-5 text-alert-ink" aria-hidden="true" />
    case 'ALERT':
      return <BellRing className="h-5 w-5 text-alert-ink" aria-hidden="true" />
    case 'ONLINE':
      return <Wifi className="h-5 w-5 text-primary" aria-hidden="true" />
    case 'OFFLINE':
      return <WifiOff className="h-5 w-5 text-ink-faint" aria-hidden="true" />
  }
}

/** Every synthetic number on screen carries this label. */
export function DemoBadge() {
  const { t } = useLocale()
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-bold text-ink-soft">
      <FlaskConical className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      {t('common.demoBadge')}
    </span>
  )
}

export function BatteryChip({ pct }: { pct: number }) {
  const { t } = useLocale()
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
      <BatteryMedium className="h-4 w-4" aria-hidden="true" />
      <span className="tnum">{t('common.battery', { n: pct })}</span>
    </span>
  )
}
