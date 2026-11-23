import {
  Bell,
  FlaskConical,
  Gauge,
  History,
  LogOut,
  Plus,
  Settings,
  Users,
} from 'lucide-react'
import { Outlet, Link, useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { authClient } from '#/lib/auth-client'
import { useLocale } from '#/lib/i18n/index'

import { DemoBadge } from './chips'

function Brand() {
  const { t } = useLocale()
  return (
    <span className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
        <circle cx="50" cy="50" r="46" fill="none" stroke="var(--primary)" strokeWidth="6" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="var(--primary)" strokeWidth="3" opacity="0.35" />
      </svg>
      <span className="text-lg font-extrabold text-ink">{t('brand.name')}</span>
    </span>
  )
}

function LangToggle() {
  const { t, setLocale, locale } = useLocale()
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
      className="rounded-lg px-2.5 py-2 text-sm font-bold text-ink-soft transition-colors hover:bg-muted hover:text-ink"
    >
      {t('common.language')}
    </button>
  )
}

export { LangToggle }

const NAV = [
  { to: '/app', labelKey: 'nav.dashboard', icon: Gauge, end: true },
  { to: '/app/history', labelKey: 'nav.history', icon: History, end: false },
  { to: '/app/alerts', labelKey: 'nav.alerts', icon: Bell, end: false },
  { to: '/app/caregivers', labelKey: 'nav.caregivers', icon: Users, end: false },
  { to: '/app/settings', labelKey: 'nav.settings', icon: Settings, end: false },
  { to: '/app/demo', labelKey: 'nav.demo', icon: FlaskConical, end: false },
  { to: '/app/setup', labelKey: 'nav.setup', icon: Plus, end: false },
] as const

function SignOutButton({ compact }: { compact?: boolean }) {
  const { t } = useLocale()
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        void authClient.signOut().then(() => {
          void navigate({ to: '/' })
        })
      }}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-ink-soft transition-colors hover:bg-alert-tint hover:text-alert-ink ${
        compact ? 'justify-center px-2' : ''
      }`}
    >
      <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!compact ? t('action.signout') : <span className="sr-only">{t('action.signout')}</span>}
    </button>
  )
}

/** The shell picks its chrome from the path, so auth and landing stay bare. */
export function AppShell({ children, deviceName }: { children: ReactNode; deviceName?: string }) {
  const { t } = useLocale()

  return (
    <div className="min-h-dvh">
      {/* Desktop rail (start side: right in RTL) */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-line bg-surface-2 md:flex">
        <div className="border-b border-line p-5">
          <Brand />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label={t('nav.dashboard')}>
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === '/app' }}
              activeProps={{ className: 'bg-primary-tint text-primary-strong' }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-ink-soft transition-colors hover:bg-muted hover:text-ink"
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          <DemoBadge />
          <LangToggle />
        </div>
      </header>

      <main className="md:ps-60">
        <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 md:px-8 md:pb-16 md:pt-10">
          {deviceName ? (
            <div className="mb-4 hidden items-center gap-3 md:flex">
              <span className="text-sm font-bold text-ink-soft">{deviceName}</span>
              <DemoBadge />
              <span className="ms-auto">
                <LangToggle />
              </span>
            </div>
          ) : null}
          {children}
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label={t('nav.dashboard')}
      >
        {NAV.slice(0, 6).map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeProps={{ className: 'text-primary-strong' }}
            className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold text-ink-soft"
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            {t(item.labelKey)}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function DisclaimerFooter() {
  const { t } = useLocale()
  return (
    <footer className="mt-14 border-t border-line pt-6">
      <p className="text-sm font-extrabold text-ink">{t('disclaimer.title')}</p>
      <p className="mt-2 text-sm leading-7 text-ink-soft">{t('disclaimer.body')}</p>
      <p className="mt-4 text-xs text-ink-faint">
        {t('brand.name')} · {t('brand.latin')}
      </p>
    </footer>
  )
}

export function AppOutlet() {
  return <Outlet />
}
