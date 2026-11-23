import { createFileRoute, Link } from '@tanstack/react-router'
import {
  BellRing,
  Eye,
  HeartPulse,
  Move3d,
  Thermometer,
  Wind,
  Zap,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import { StatusRing } from '#/components/ring'
import { DemoBadge, StatusWord } from '#/components/chips'
import { LangToggle } from '#/components/app-shell'

import { useLocale } from '#/lib/i18n/index'

export const Route = createFileRoute('/')({ component: Landing })

const PREVIEW = [
  { icon: HeartPulse, value: '72', key: 'dash.vitals.hr' },
  { icon: Wind, value: '97%', key: 'dash.vitals.spo2' },
  { icon: Thermometer, value: '36.6', key: 'dash.vitals.temp' },
  { icon: Zap, value: '240', key: 'dash.vitals.gsr' },
  { icon: Move3d, value: '9.8', key: 'dash.vitals.motion' },
] as const

const STEPS = [
  { icon: Eye, title: 'landing.step1.title', body: 'landing.step1.body' },
  { icon: HeartPulse, title: 'landing.step2.title', body: 'landing.step2.body' },
  { icon: BellRing, title: 'landing.step3.title', body: 'landing.step3.body' },
] as const

function Landing() {
  const { t } = useLocale()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 md:px-8">
          <span className="flex items-center gap-2.5">
            <svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="46" fill="none" stroke="var(--primary)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="36"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3"
                opacity="0.35"
              />
            </svg>
            <span className="text-lg font-extrabold text-ink">{t('brand.name')}</span>
          </span>
          <div className="flex items-center gap-2">
            <LangToggle />
            <Button asChild variant="ghost">
              <Link to="/auth/sign-in">{t('landing.cta.secondary')}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 md:px-8">
        <section className="soft-in grid items-center gap-12 py-12 md:grid-cols-[1.1fr_0.9fr] md:py-20">
          <div>
            <h1 className="text-3xl font-extrabold leading-[1.3] text-ink md:text-[2.9rem] md:leading-[1.25]">
              {t('landing.h1')}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-9 text-ink-soft">{t('landing.sub')}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/auth/sign-up">{t('landing.cta.primary')}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth/sign-in">{t('landing.cta.secondary')}</Link>
              </Button>
            </div>
          </div>

          <div className="card-soft soft-in rounded-2xl p-6 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-ink-soft">{t('landing.preview')}</span>
              <DemoBadge />
            </div>
            <div className="mt-6 flex justify-center">
              <StatusRing status="SAFE" initials="س" size={150} label={t('dash.status.safe')} />
            </div>
            <div className="mt-6 flex justify-center">
              <StatusWord status="SAFE" />
            </div>
            <div className="mt-6 grid grid-cols-5 gap-2 border-t border-line pt-5">
              {PREVIEW.map((item) => (
                <div key={item.key} className="flex flex-col items-center gap-1 text-center">
                  <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="tnum text-sm font-extrabold text-ink">{item.value}</span>
                  <span className="text-[10px] leading-tight text-ink-faint">{t(item.key)}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-ink-faint">{t('landing.vitalsNote')}</p>
          </div>
        </section>

        <section aria-label={t('landing.step1.title')} className="border-t border-line pt-10">
          <ol className="grid gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-strong">
                  <step.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
                    <span className="tnum text-sm font-bold text-ink-faint">{i + 1}</span>
                    {t(step.title)}
                  </h2>
                  <p className="mt-1.5 text-sm leading-7 text-ink-soft">{t(step.body)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-16 border-t border-line py-8">
          <div className="rounded-xl border border-line bg-watch-tint/60 p-5">
            <p className="text-sm font-extrabold text-watch-ink">{t('disclaimer.title')}</p>
            <p className="mt-2 text-sm leading-7 text-ink-soft">{t('disclaimer.body')}</p>
          </div>
          <p className="mt-6 text-xs text-ink-faint">
            {t('brand.name')} · {t('brand.latin')}
          </p>
        </footer>
      </main>
    </div>
  )
}
