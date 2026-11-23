import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Check, MapPin } from 'lucide-react'

import { ackEvent, getAppData } from '#/functions/devices'
import type { AppData, AppEvent } from '#/functions/devices'

import { DisclaimerFooter } from '#/components/app-shell'
import { EventIcon } from '#/components/chips'
import { Button } from '#/components/ui/button'

import { useLocale } from '#/lib/i18n/index'
import { formatDateTime, formatNumber } from '#/lib/format'

export const Route = createFileRoute('/app/alerts')({
  loader: () => getAppData(),
  component: AlertsPage,
})

type Filter = 'all' | 'alert' | 'sos' | 'conn'

function AlertsPage() {
  const result = Route.useLoaderData()
  const { t, locale } = useLocale()
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [unackedOnly, setUnackedOnly] = useState(false)
  const [ackedNow, setAckedNow] = useState<Record<string, boolean>>({})

  if (!result.ok) {
    return (
      <div>
        <p className="rounded-xl bg-alert-tint px-4 py-3 text-sm font-bold text-alert-ink">
          {t('common.error')}
        </p>
        <DisclaimerFooter />
      </div>
    )
  }

  const data: AppData = result.data
  const allEvents: AppEvent[] = data.events

  const events = useMemo(() => {
    const sorted = [...allEvents].sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
    )
    return sorted.filter((e) => {
      if (filter === 'alert' && e.type !== 'ALERT') return false
      if (filter === 'sos' && e.type !== 'SOS') return false
      if (filter === 'conn' && e.type !== 'ONLINE' && e.type !== 'OFFLINE') return false
      const acked = e.acknowledgedBy != null || ackedNow[e.id]
      if (unackedOnly && acked) return false
      return true
    })
  }, [allEvents, filter, unackedOnly, ackedNow])

  async function ack(event: AppEvent) {
    setAckedNow((prev) => ({ ...prev, [event.id]: true }))
    const res = await ackEvent({ data: { eventId: event.id } })
    if (res.ok) {
      // refresh loaders so other pages agree immediately
      void router.invalidate()
    } else {
      setAckedNow((prev) => {
        const next = { ...prev }
        delete next[event.id]
        return next
      })
    }
  }

  const FILTERS: { id: Filter; labelKey: string }[] = [
    { id: 'all', labelKey: 'alerts.filter.all' },
    { id: 'alert', labelKey: 'alerts.filter.alert' },
    { id: 'sos', labelKey: 'alerts.filter.sos' },
    { id: 'conn', labelKey: 'alerts.filter.conn' },
  ]

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t('alerts.title')}</h1>
          <p className="mt-1.5 text-sm text-ink-soft">{t('alerts.subtitle')}</p>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3.5 py-2 text-sm font-bold transition-colors ${
              filter === f.id
                ? 'bg-primary text-primary-ink'
                : 'border border-line bg-surface text-ink-soft hover:bg-muted'
            }`}
          >
            {t(f.labelKey)}
          </button>
        ))}
        <label className="ms-auto flex min-h-11 cursor-pointer items-center gap-2 py-2 text-sm font-bold text-ink-soft">
          <input
            type="checkbox"
            checked={unackedOnly}
            onChange={(e) => setUnackedOnly(e.target.checked)}
            className="h-5 w-5 accent-[var(--primary)]"
          />
          {t('alerts.filter.unacked')}
        </label>
      </div>

      <ul className="mt-4 space-y-3">
        {events.length === 0 ? (
          <li className="card-soft rounded-2xl p-6 text-sm text-ink-soft">{t('alerts.empty')}</li>
        ) : null}
        {events.map((event) => {
          const acked = event.acknowledgedBy != null || ackedNow[event.id]
          return (
            <li
              key={event.id}
              className="card-soft flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:gap-5 md:p-5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
                <EventIcon type={event.type} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-base font-extrabold text-ink">{t(`event.${event.type}`)}</p>
                <p className="tnum mt-0.5 text-sm text-ink-soft">
                  {formatDateTime(event.capturedAt, locale)}
                </p>
                {event.lat != null && event.lng != null ? (
                  <a
                    href={`https://maps.google.com/?q=${event.lat},${event.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="tnum mt-1.5 inline-flex min-h-8 items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-strong"
                  >
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {formatNumber(event.lat, locale, 4)}, {formatNumber(event.lng, locale, 4)}
                    <span className="text-ink-faint">· {t('alerts.openMap')}</span>
                  </a>
                ) : null}
              </div>

              <div className="flex items-center gap-3 md:flex-col md:items-end">
                {acked ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-safe-tint px-3 py-1 text-xs font-bold text-safe-ink">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('alerts.ackedBy', {
                      name: ackedNow[event.id] ? t('common.you') : (event.acknowledgedBy ?? ''),
                    })}
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center rounded-full bg-watch-tint px-3 py-1 text-xs font-bold text-watch-ink">
                      {t('alerts.unacked')}
                    </span>
                    {event.type === 'ALERT' || event.type === 'SOS' ? (
                      <Button size="sm" onClick={() => void ack(event)}>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        {t('action.ack')}
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <DisclaimerFooter />
    </div>
  )
}
