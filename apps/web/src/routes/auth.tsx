import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { getSessionState } from '#/functions/session'

import { StatusRing } from '#/components/ring'
import { useLocale } from '#/lib/i18n/index'

export const Route = createFileRoute('/auth')({
  beforeLoad: async () => {
    // Already signed in: the auth screens have nothing to offer.
    const session = await getSessionState()
    if (session.signedIn) {
      throw redirect({ to: '/app' })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  const { t } = useLocale()

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Form side */}
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md soft-in">
          <Outlet />
        </div>
      </div>

      {/* Quiet side: committed teal field, the ring at rest */}
      <div
        className="hidden flex-col justify-between p-12 lg:flex"
        style={{ background: 'linear-gradient(160deg, var(--primary) 0%, var(--primary-strong) 100%)' }}
      >
        <span className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--primary-ink)" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="36"
              fill="none"
              stroke="var(--primary-ink)"
              strokeWidth="3"
              opacity="0.4"
            />
          </svg>
          <span className="text-2xl font-extrabold" style={{ color: 'var(--primary-ink)' }}>
            {t('brand.name')}
          </span>
        </span>

        <div className="flex items-center gap-8">
          <StatusRing status="SAFE" initials="س" size={170} label={t('dash.status.safe')} />
          <p
            className="max-w-sm text-xl font-bold leading-9"
            style={{ color: 'var(--primary-ink)' }}
          >
            {t('auth.side.body')}
          </p>
        </div>

        <p
          className="max-w-md text-xs leading-6"
          style={{ color: 'var(--primary-ink)', opacity: 0.75 }}
        >
          {t('disclaimer.title')} {t('disclaimer.body')}
        </p>
      </div>
    </div>
  )
}
