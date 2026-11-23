import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'

import { getAppData } from '#/functions/devices'
import type { AppData, AppEvent } from '#/functions/devices'

import { DisclaimerFooter } from '#/components/app-shell'
import { BatteryChip, DemoBadge, EventIcon, StatusWord } from '#/components/chips'
import { StatusRing } from '#/components/ring'
import { TimelineChart } from '#/components/timeline-chart'
import { VitalCard } from '#/components/vitals'
import { Button } from '#/components/ui/button'

import { useLocale } from '#/lib/i18n/index'
import { formatClock, formatNumber, formatRelative } from '#/lib/format'

export const Route = createFileRoute('/app/')({
  loader: () => getAppData(),
  component: DashboardPage,
})

type DashboardStatus = 'SAFE' | 'WATCH' | 'ALERT' | 'SOS'

function DashboardPage() {
  const result = Route.useLoaderData()
  const { t, locale } = useLocale()

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

  if (!data.hasDevice || !data.device) {
    return (
      <div className="soft-in card-soft mx-auto max-w-lg rounded-2xl p-8 text-center md:p-10">
        <div className="flex justify-center">
          <StatusRing
            status="SAFE"
            initials={data.userName.charAt(0)}
            size={110}
            label="SENSA"
          />
        </div>
        <h1 className="mt-6 text-xl font-extrabold text-ink">{t('dash.empty.title')}</h1>
        <p className="mt-2 text-sm leading-7 text-ink-soft">{t('dash.empty.body')}</p>
        <div className="mt-6">
          <Button asChild size="lg">
            <Link to="/app/setup">{t('action.goSetup')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  const latest = data.readings[data.readings.length - 1]
  const sparkWindow = data.readings.slice(-90)
  const chartWindow = data.readings.slice(-30)

  const heroStatus: DashboardStatus = (() => {
    const unackedSos = data.events.some((e) => e.type === 'SOS' && !e.acknowledgedBy)
    if (unackedSos) return 'SOS'
    return (latest?.status ?? 'SAFE') as DashboardStatus
  })()

  const statusWordKey =
    heroStatus === 'SOS' ? 'dash.status.sos' : `dash.status.${heroStatus.toLowerCase()}`

  const heroTint: Record<DashboardStatus, string> = {
    SAFE: 'color-mix(in oklab, var(--safe-tint) 55%, var(--surface))',
    WATCH: 'color-mix(in oklab, var(--watch-tint) 55%, var(--surface))',
    ALERT: 'color-mix(in oklab, var(--alert-tint) 55%, var(--surface))',
    SOS: 'color-mix(in oklab, var(--alert-tint) 70%, var(--surface))',
  }

  const relLatest = latest
    ? t('dash.lastUpdate', {
        rel: formatRelative(data.anchor - new Date(latest.capturedAt).getTime(), locale),
      })
    : t('dash.noReading')

  const flagKeys: Record<string, string> = {
    'heart rate high': 'flag.hrHigh',
    'heart rate low': 'flag.hrLow',
    'SpO2 low': 'flag.spo2Low',
    'temperature high': 'flag.tempHigh',
    'GSR signal changed': 'flag.gsr',
    'motion changed': 'flag.motion',
  }

  const reason = (latest?.flags ?? []).map((f) => t(flagKeys[f] ?? f)).join('، ')

  const online = data.device.status === 'ONLINE'
  const gsrK = latest?.gsrOhm != null ? latest.gsrOhm / 1000 : null
  const motionMag =
    latest?.accelX != null && latest.accelY != null && latest.accelZ != null
      ? Math.sqrt(latest.accelX ** 2 + latest.accelY ** 2 + latest.accelZ ** 2)
      : null

  return (
    <div>
      {/* Status hero: the one question this shell answers */}
      <section
        aria-label={t(statusWordKey)}
        className="soft-in rounded-2xl border border-line p-6 md:p-8"
        style={{ background: heroTint[heroStatus] }}
      >
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:gap-10">
          <StatusRing
            status={heroStatus}
            initials={data.wearer.name.charAt(0)}
            size={124}
            label={t(statusWordKey)}
          />
          <div className="min-w-0 flex-1">
            <h1
              className={`text-3xl font-extrabold md:text-4xl ${
                heroStatus === 'SAFE'
                  ? 'text-safe-ink'
                  : heroStatus === 'WATCH'
                    ? 'text-watch-ink'
                    : 'text-alert-ink'
              }`}
            >
              {t(statusWordKey)}
            </h1>
            {reason ? <p className="mt-2 text-base font-bold text-ink">{reason}</p> : null}
            <p className="tnum mt-2 text-sm text-ink-soft">{relLatest}</p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <span className="flex items-center gap-2 text-sm font-bold text-ink">
              {data.device.name}
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                  online ? 'text-safe-ink' : 'text-ink-faint'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${online ? 'bg-safe-ink' : 'bg-ink-faint'}`}
                  aria-hidden="true"
                />
                {online ? t('common.online') : t('common.offline')}
              </span>
            </span>
            {data.device.batteryPct != null ? (
              <BatteryChip pct={Math.round(data.device.batteryPct)} />
            ) : null}
            {data.device.isDemo ? <DemoBadge /> : null}
          </div>
        </div>
      </section>

      {/* Vitals grid */}
      <section
        aria-label={t('dash.vitals.hr')}
        className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
      >
        <VitalCard
          vital="hr"
          value={latest?.hrBpm != null ? formatNumber(latest.hrBpm, locale, 0) : null}
          series={sparkWindow.map((r) => r.hrBpm)}
          status={latest?.status ?? 'SAFE'}
          range={t('dash.range.normal', {
            range: `${formatNumber(data.thresholds.hrLowBpm, locale)}–${formatNumber(data.thresholds.hrHighBpm, locale)}`,
          })}
        />
        <VitalCard
          vital="spo2"
          value={latest?.spo2Pct != null ? `${formatNumber(latest.spo2Pct, locale, 0)}%` : null}
          series={sparkWindow.map((r) => r.spo2Pct)}
          status={latest?.status ?? 'SAFE'}
          range={t('dash.range.normal', { range: `≥ ${formatNumber(data.thresholds.spo2LowPct, locale)}%` })}
        />
        <VitalCard
          vital="temp"
          value={latest?.tempC != null ? formatNumber(latest.tempC, locale, 1) : null}
          series={sparkWindow.map((r) => r.tempC)}
          status={latest?.status ?? 'SAFE'}
          range={t('dash.range.normal', { range: `< ${formatNumber(data.thresholds.tempHighC, locale, 1)}°` })}
        />
        <VitalCard
          vital="gsr"
          value={gsrK != null ? formatNumber(gsrK, locale, 0) : null}
          series={sparkWindow.map((r) => (r.gsrOhm != null ? r.gsrOhm / 1000 : null))}
          status={latest?.status ?? 'SAFE'}
          range={t('dash.range.normal', {
            range: `±${formatNumber(Math.round(data.thresholds.gsrChangeThreshold * 100), locale)}%`,
          })}
        />
        <VitalCard
          vital="motion"
          value={motionMag != null ? formatNumber(motionMag, locale, 1) : null}
          series={sparkWindow.map((r) =>
            r.accelX != null && r.accelY != null && r.accelZ != null
              ? Math.sqrt(r.accelX ** 2 + r.accelY ** 2 + r.accelZ ** 2)
              : null,
          )}
          status={latest?.status ?? 'SAFE'}
          range={t('dash.vitals.motion.unit')}
        />
      </section>

      {/* Last hour chart */}
      {chartWindow.length > 1 ? (
        <section aria-label={t('history.range.1h')} className="card-soft mt-6 rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-lg font-extrabold text-ink">{t('history.range.1h')}</h2>
            <StatusWord status={(latest?.status ?? 'SAFE') as DashboardStatus} />
          </div>
          <TimelineChart readings={chartWindow} />
        </section>
      ) : null}

      {/* Events + device */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-label={t('dash.events.title')} className="card-soft rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-ink">{t('dash.events.title')}</h2>
            <Link
              to="/app/alerts"
              className="inline-flex min-h-8 items-center gap-1 text-sm font-bold text-primary hover:text-primary-strong"
            >
              {t('action.viewAll')}
              <ChevronLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" aria-hidden="true" />
            </Link>
          </div>
          {data.events.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-faint">{t('dash.events.empty')}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {data.events.slice(0, 4).map((event: AppEvent) => (
                <li key={event.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <EventIcon type={event.type} />
                  </span>
                  <span className="text-sm font-bold text-ink">{t(`event.${event.type}`)}</span>
                  <span className="tnum ms-auto text-xs text-ink-faint">
                    {formatClock(event.capturedAt, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label={t('dash.deviceCard')} className="card-soft rounded-2xl p-5 md:p-6">
          <h2 className="text-lg font-extrabold text-ink">{t('dash.deviceCard')}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{t('dash.device')}</dt>
              <dd className="font-bold text-ink">{data.device.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{online ? t('common.online') : t('common.offline')}</dt>
              <dd className={online ? 'font-bold text-safe-ink' : 'font-bold text-ink-faint'}>
                {online ? t('common.online') : t('common.offline')}
              </dd>
            </div>
            {data.device.batteryPct != null ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">{t('dash.battery')}</dt>
                <dd className="tnum font-bold text-ink">
                  {formatNumber(Math.round(data.device.batteryPct), locale)}%
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{t('common.lastSeenShort')}</dt>
              <dd className="tnum font-bold text-ink">
                {data.device.lastSeenAt ? formatClock(data.device.lastSeenAt, locale) : '—'}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <DisclaimerFooter />
    </div>
  )
}
