import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { BellRing, Check } from 'lucide-react'

import { getAppData, updateThresholds } from '#/functions/devices'
import type { AppData } from '#/functions/devices'
import { thresholdsSchema } from '@sensa/contracts'

import { DisclaimerFooter } from '#/components/app-shell'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

import { authClient } from '#/lib/auth-client'
import { useLocale } from '#/lib/i18n/index'

export const Route = createFileRoute('/app/settings')({
  loader: () => getAppData(),
  component: SettingsPage,
})

type PushState = 'idle' | 'pending' | 'enabled' | 'blocked' | 'unavailable'

function SettingsPage() {
  const result = Route.useLoaderData()
  const { t, locale, setLocale } = useLocale()
  const router = useRouter()

  const session = authClient.useSession()
  const user = session.data?.user

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
  const device = data.device

  const [th, setTh] = useState({
    tempHighC: String(data.thresholds.tempHighC),
    hrLowBpm: String(data.thresholds.hrLowBpm),
    hrHighBpm: String(data.thresholds.hrHighBpm),
    spo2LowPct: String(data.thresholds.spo2LowPct),
    gsrChangeThreshold: String(data.thresholds.gsrChangeThreshold),
    motionDeltaThreshold: String(data.thresholds.motionDeltaThreshold),
  })
  const [saved, setSaved] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [saving, setSaving] = useState(false)

  const FIELDS = [
    { key: 'tempHighC', labelKey: 'set.th.temp', unit: '°C' },
    { key: 'hrLowBpm', labelKey: 'set.th.hrLow', unit: 'bpm' },
    { key: 'hrHighBpm', labelKey: 'set.th.hrHigh', unit: 'bpm' },
    { key: 'spo2LowPct', labelKey: 'set.th.spo2', unit: '%' },
    { key: 'gsrChangeThreshold', labelKey: 'set.th.gsr', unit: 'Δ' },
    { key: 'motionDeltaThreshold', labelKey: 'set.th.motion', unit: 'Δ' },
  ] as const

  async function onSave(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    setInvalid(false)
    const parsed = thresholdsSchema.safeParse({
      tempHighC: Number(th.tempHighC),
      hrLowBpm: Number(th.hrLowBpm),
      hrHighBpm: Number(th.hrHighBpm),
      spo2LowPct: Number(th.spo2LowPct),
      gsrChangeThreshold: Number(th.gsrChangeThreshold),
      motionDeltaThreshold: Number(th.motionDeltaThreshold),
    })
    if (!parsed.success || !device) {
      setInvalid(true)
      return
    }
    setSaving(true)
    const res = await updateThresholds({ data: { deviceId: device.id, ...parsed.data } })
    setSaving(false)
    if (!res.ok) {
      setInvalid(true)
      return
    }
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
    void router.invalidate()
  }

  const [pushState, setPushState] = useState<PushState>('idle')

  async function onEnablePush() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setPushState('unavailable')
      return
    }
    setPushState('pending')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushState('blocked')
        return
      }
      const res = await fetch('/api/push/vapid')
      if (!res.ok) {
        setPushState('unavailable')
        return
      }
      const { publicKey } = (await res.json()) as { publicKey: string }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      })
      const subJson = subscription.toJSON() as {
        endpoint?: string
        keys?: { p256dh?: string; auth?: string }
      }
      const save = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth },
        }),
      })
      if (!save.ok) {
        setPushState('unavailable')
        return
      }
      setPushState('enabled')
    } catch {
      setPushState('unavailable')
    }
  }

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t('set.title')}</h1>
        </div>
      </header>

      {device ? (
        <section className="card-soft mt-5 rounded-2xl p-5 md:p-6">
          <h2 className="text-lg font-extrabold text-ink">{t('set.thresholds.title')}</h2>
          <p className="mt-1.5 text-sm leading-7 text-ink-soft">{t('set.thresholds.subtitle')}</p>
          <form onSubmit={(e) => void onSave(e)} noValidate className="mt-5">
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`th-${field.key}`}>
                    {t(field.labelKey)}{' '}
                    <span className="text-xs font-normal text-ink-faint" dir="ltr">
                      ({field.unit})
                    </span>
                  </Label>
                  <Input
                    id={`th-${field.key}`}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    className="tnum max-w-[180px]"
                    value={th[field.key]}
                    onChange={(e) => setTh((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {invalid ? (
              <p role="alert" className="mt-4 text-sm font-bold text-alert-ink">
                {t('set.th.invalid')}
              </p>
            ) : null}
            {saved ? (
              <p
                role="status"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-safe-ink"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {t('set.th.saved')}
              </p>
            ) : null}
            <div className="mt-5">
              <Button type="submit" disabled={saving}>
                {saving ? t('common.loading') : t('action.save')}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card-soft rounded-2xl p-5 md:p-6">
          <h2 className="text-lg font-extrabold text-ink">{t('set.language.title')}</h2>
          <div className="mt-4 flex gap-2">
            {(['ar', 'en'] as const).map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={locale === code}
                onClick={() => setLocale(code)}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                  locale === code
                    ? 'bg-primary text-primary-ink'
                    : 'border border-line bg-surface text-ink-soft hover:bg-muted'
                }`}
              >
                {t(code === 'ar' ? 'set.language.ar' : 'set.language.en')}
              </button>
            ))}
          </div>
        </section>

        <section className="card-soft rounded-2xl p-5 md:p-6">
          <h2 className="text-lg font-extrabold text-ink">{t('set.push.title')}</h2>
          <div className="mt-4">
            {pushState === 'enabled' ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-bold text-safe-ink">
                <Check className="h-4 w-4" aria-hidden="true" />
                {t('set.push.enabled')}
              </p>
            ) : (
              <Button
                variant="outline"
                onClick={() => void onEnablePush()}
                disabled={pushState === 'pending'}
              >
                <BellRing className="h-4 w-4" aria-hidden="true" />
                {pushState === 'pending' ? t('common.loading') : t('set.push.enable')}
              </Button>
            )}
          </div>
          {pushState === 'unavailable' || pushState === 'blocked' ? (
            <p className="mt-3 text-xs leading-6 text-ink-faint">{t('set.push.note.https')}</p>
          ) : null}
          <p className="mt-3 text-xs leading-6 text-ink-faint">{t('set.push.note.ios')}</p>
        </section>
      </div>

      <section className="card-soft mt-6 rounded-2xl p-5 md:p-6">
        <h2 className="text-lg font-extrabold text-ink">{t('set.account.title')}</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap justify-between gap-3">
            <dt className="text-ink-soft">{t('auth.name')}</dt>
            <dd className="font-bold text-ink">{user?.name ?? '—'}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <dt className="text-ink-soft">{t('auth.email')}</dt>
            <dd className="font-bold text-ink" dir="ltr">
              {user?.email ?? '—'}
            </dd>
          </div>
        </dl>
        <div className="mt-5">
          <Button
            variant="outline"
            onClick={() => {
              void authClient.signOut()
            }}
          >
            {t('action.signout')}
          </Button>
        </div>
      </section>

      <DisclaimerFooter />
    </div>
  )
}
