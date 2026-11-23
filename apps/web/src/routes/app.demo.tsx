import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'

import { evaluateReading, DEFAULT_THRESHOLDS } from '@sensa/contracts'
import type { ReadingInput, ReadingStatus } from '@sensa/contracts'

import { DisclaimerFooter } from '#/components/app-shell'
import { DemoBadge, StatusWord } from '#/components/chips'
import { StatusRing } from '#/components/ring'
import { Button } from '#/components/ui/button'

import { useLocale } from '#/lib/i18n/index'
import { formatClock, formatNumber } from '#/lib/format'

export const Route = createFileRoute('/app/demo')({ component: DemoPage })

type Scenario = 'safe' | 'watch' | 'alert' | 'sos'

interface DemoLogEntry {
  id: number
  at: string
  text: string
  tone: 'info' | 'warn' | 'alert'
}

const PROFILES: Record<Scenario, {
  hr: [number, number]
  spo2: [number, number]
  temp: [number, number]
  gsrK: [number, number]
}> = {
  safe: { hr: [68, 78], spo2: [96, 98], temp: [36.4, 36.8], gsrK: [225, 255] },
  watch: { hr: [92, 108], spo2: [93, 96], temp: [36.9, 37.4], gsrK: [270, 330] },
  alert: { hr: [120, 136], spo2: [85, 91], temp: [37.6, 38.2], gsrK: [380, 440] },
  sos: { hr: [124, 140], spo2: [84, 90], temp: [37.8, 38.4], gsrK: [400, 460] },
}

function rand(range: [number, number]): number {
  return range[0] + Math.random() * (range[1] - range[0])
}

function DemoPage() {
  const { t, locale } = useLocale()

  const [running, setRunning] = useState(false)
  const [scenario, setScenario] = useState<Scenario>('safe')
  const [rateMs, setRateMs] = useState(1000)
  const [readings, setReadings] = useState<ReadingInput[]>([])
  const [log, setLog] = useState<DemoLogEntry[]>([])
  const gsrBaselineRef = useRef<number | null>(null)
  const logIdRef = useRef(0)

  // Seed a short quiet baseline so the ring has something to breathe with.
  useEffect(() => {
    const seed: ReadingInput[] = []
    for (let i = 24; i > 0; i--) {
      seed.push({
        capturedAt: new Date(Date.now() - i * 1000).toISOString(),
        hrBpm: Math.round(rand(PROFILES.safe.hr) * 10) / 10,
        spo2Pct: Math.round(rand(PROFILES.safe.spo2) * 10) / 10,
        tempC: Math.round(rand(PROFILES.safe.temp) * 100) / 100,
        gsrOhm: Math.round(rand(PROFILES.safe.gsrK) * 1000),
        accelX: 0.1,
        accelY: 0.05,
        accelZ: 9.8,
        status: 'SAFE',
        flags: [],
      })
    }
    setReadings(seed)
  }, [])

  // The live tick: generate, evaluate with the real contracts logic, log.
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      const profile = PROFILES[scenario]
      const reading: ReadingInput = {
        capturedAt: new Date().toISOString(),
        hrBpm: Math.round(rand(profile.hr) * 10) / 10,
        spo2Pct: Math.round(rand(profile.spo2) * 10) / 10,
        tempC: Math.round(rand(profile.temp) * 100) / 100,
        gsrOhm: Math.round(rand(profile.gsrK) * 1000),
        accelX: Math.round(rand([-0.4, 0.4]) * 100) / 100,
        accelY: Math.round(rand([-0.4, 0.4]) * 100) / 100,
        accelZ: 9.8,
        status: 'SAFE',
        flags: [],
      }

      const { status, flags } = evaluateReading(
        reading,
        DEFAULT_THRESHOLDS,
        gsrBaselineRef.current,
      )
      reading.status = status
      reading.flags = flags
      if (reading.gsrOhm != null) {
        gsrBaselineRef.current =
          gsrBaselineRef.current == null
            ? reading.gsrOhm
            : 0.95 * gsrBaselineRef.current + 0.05 * reading.gsrOhm
      }

      setReadings((prev) => [...prev.slice(-59), reading])
    }, rateMs)
    return () => window.clearInterval(timer)
  }, [running, scenario, rateMs])

  // Event log follows status transitions and scenario switches.
  const lastStatusRef = useRef<string>('SAFE')
  useEffect(() => {
    const latest = readings[readings.length - 1]
    if (!latest) return
    const statusKey = scenario === 'sos' ? 'SOS' : latest.status
    if (statusKey !== lastStatusRef.current) {
      lastStatusRef.current = statusKey
      const entry: DemoLogEntry = {
        id: logIdRef.current++,
        at: latest.capturedAt,
        text:
          statusKey === 'SOS'
            ? t('event.SOS')
            : t(`dash.status.${statusKey.toLowerCase()}`),
        tone: statusKey === 'SOS' || statusKey === 'ALERT' ? 'alert' : statusKey === 'WATCH' ? 'warn' : 'info',
      }
      setLog((prev) => [entry, ...prev].slice(0, 8))
    }
  }, [readings, scenario, t])

  const latest = readings[readings.length - 1]
  const heroStatus: ReadingStatus | 'SOS' = scenario === 'sos' ? 'SOS' : (latest?.status ?? 'SAFE')
  const values = [
    { key: 'dash.vitals.hr', value: latest?.hrBpm != null ? formatNumber(latest.hrBpm, locale, 0) : '—' },
    { key: 'dash.vitals.spo2', value: latest?.spo2Pct != null ? `${formatNumber(latest.spo2Pct, locale, 0)}%` : '—' },
    { key: 'dash.vitals.temp', value: latest?.tempC != null ? formatNumber(latest.tempC, locale, 1) : '—' },
    { key: 'dash.vitals.gsr', value: latest?.gsrOhm != null ? formatNumber(latest.gsrOhm / 1000, locale, 0) : '—' },
  ]

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t('demo.title')}</h1>
          <p className="mt-1.5 text-sm text-ink-soft">{t('demo.subtitle')}</p>
        </div>
        <DemoBadge />
      </header>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Live stage */}
        <section
          className="card-soft flex flex-col items-center rounded-2xl p-6 md:p-10"
          aria-label={t('demo.title')}
        >
          <StatusRing
            status={heroStatus}
            initials="س"
            size={190}
            label={t(heroStatus === 'SOS' ? 'dash.status.sos' : `dash.status.${(heroStatus as string).toLowerCase()}`)}
          />
          <div className="mt-6">
            <StatusWord status={heroStatus} />
          </div>
          <div className="mt-8 grid w-full grid-cols-4 gap-3 border-t border-line pt-6">
            {values.map((v) => (
              <div key={v.key} className="flex flex-col items-center gap-1">
                <span className="tnum text-2xl font-extrabold text-ink">{v.value}</span>
                <span className="text-xs text-ink-faint">{t(v.key)}</span>
              </div>
            ))}
          </div>
          {latest ? (
            <p className="tnum mt-4 text-xs text-ink-faint">
              {formatClock(latest.capturedAt, locale)}
            </p>
          ) : null}
        </section>

        {/* Controls */}
        <div className="flex flex-col gap-6">
          <section className="card-soft rounded-2xl p-5">
            <Button
              className="w-full"
              size="lg"
              variant={running ? 'outline' : 'default'}
              onClick={() => setRunning((prev) => !prev)}
            >
              {running ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
              {running ? t('demo.pause') : t('demo.play')}
            </Button>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(['safe', 'watch', 'alert', 'sos'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={scenario === s}
                  onClick={() => setScenario(s)}
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                    scenario === s
                      ? 'bg-primary text-primary-ink'
                      : 'border border-line bg-surface text-ink-soft hover:bg-muted'
                  }`}
                >
                  {t(`demo.scenario.${s}`)}
                </button>
              ))}
            </div>

            <label htmlFor="demo-rate" className="mt-5 block text-sm font-bold text-ink-soft">
              {t('demo.rate')}
              <span className="tnum ms-2 text-xs text-ink-faint" dir="ltr">
                {formatNumber(rateMs / 1000, locale, 1)}s
              </span>
            </label>
            <input
              id="demo-rate"
              type="range"
              min={300}
              max={2000}
              step={100}
              value={rateMs}
              onChange={(e) => setRateMs(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--primary)]"
            />
          </section>

          <section className="card-soft rounded-2xl p-5" aria-label={t('demo.log')}>
            <h2 className="text-sm font-extrabold text-ink-soft">{t('demo.log')}</h2>
            <ul className="mt-3 space-y-2">
              {log.length === 0 ? <li className="text-xs text-ink-faint">—</li> : null}
              {log.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      entry.tone === 'alert'
                        ? 'bg-alert-ink'
                        : entry.tone === 'warn'
                          ? 'bg-watch-ink'
                          : 'bg-safe-ink'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-bold text-ink">{entry.text}</span>
                  <span className="tnum ms-auto text-xs text-ink-faint">
                    {formatClock(entry.at, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <p className="px-1 text-xs leading-6 text-ink-faint">{t('demo.note')}</p>
        </div>
      </div>

      <DisclaimerFooter />
    </div>
  )
}
