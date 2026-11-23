import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Check, Copy, FlaskConical, Radio } from 'lucide-react'

import {
  createDemoDevice,
  createDevice,
  getAppData,
  joinDevice,
} from '#/functions/devices'
import type { CreatedDevice } from '#/functions/devices'

import { DisclaimerFooter } from '#/components/app-shell'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

import { copyText } from '#/lib/copy'
import { useLocale } from '#/lib/i18n/index'

export const Route = createFileRoute('/app/setup')({
  loader: () => getAppData(),
  component: SetupPage,
})

function SetupPage() {
  const result = Route.useLoaderData()
  const { t } = useLocale()
  const router = useRouter()

  const [code, setCode] = useState('')
  const [joinState, setJoinState] = useState<'idle' | 'ok' | 'notfound' | 'exists' | 'error'>(
    'idle',
  )
  const [deviceName, setDeviceName] = useState('')
  const [created, setCreated] = useState<CreatedDevice | null>(null)
  const [creating, setCreating] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState(false)

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

  async function onPair(event: FormEvent) {
    event.preventDefault()
    if (!code.trim()) return
    const res = await joinDevice({ data: { code } })
    if (res.ok) {
      setJoinState('ok')
      void router.invalidate()
    } else {
      const err = res as { code?: string }
      setJoinState(
        err.code === 'ALREADY_MEMBER'
          ? 'exists'
          : err.code === 'NOT_FOUND'
            ? 'notfound'
            : 'error',
      )
    }
  }

  async function onCreate(kind: 'real' | 'demo') {
    setCreating(true)
    const res =
      kind === 'demo'
        ? await createDemoDevice()
        : await createDevice({ data: { name: deviceName } })
    setCreating(false)
    if (res.ok) {
      setCreated(res.data)
      void router.invalidate()
    }
  }

  const simCommand = created
    ? `bun run --filter @sensa/device-sim start -- --device ${created.device.id} --token ${created.token}`
    : ''

  async function copy(value: string, which: 'token' | 'cmd') {
    const ok = await copyText(value)
    if (!ok) return
    if (which === 'token') {
      setCopiedToken(true)
      window.setTimeout(() => setCopiedToken(false), 2000)
    } else {
      setCopiedCmd(true)
      window.setTimeout(() => setCopiedCmd(false), 2000)
    }
  }

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t('setup.title')}</h1>
          <p className="mt-1.5 text-sm text-ink-soft">{t('setup.subtitle')}</p>
        </div>
      </header>

      {created ? (
        /* Provisioning result: the one and only appearance of the token */
        <section className="card-soft soft-in mt-5 rounded-2xl p-5 md:p-6">
          <h2 className="inline-flex items-center gap-2 text-lg font-extrabold text-safe-ink">
            <Check className="h-5 w-5" aria-hidden="true" />
            {t('setup.device.created')} · {created.device.name}
          </h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-sm font-bold text-ink-soft">{t('cg.pair.title')}</p>
              <p
                className="tnum mt-2 inline-block rounded-xl border border-dashed border-line-strong bg-surface-2 px-4 py-2.5 text-xl font-extrabold tracking-widest text-primary-strong"
                dir="ltr"
              >
                {created.device.pairingCode}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-ink-soft">{t('setup.token.title')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <code
                  className="block max-w-full overflow-x-auto rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-xs font-bold break-all text-ink"
                  dir="ltr"
                >
                  {created.token}
                </code>
                <Button variant="outline" size="sm" onClick={() => void copy(created.token, 'token')}>
                  {copiedToken ? (
                    <Check className="h-4 w-4 text-safe-ink" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copiedToken ? t('action.copied') : t('action.copy')}
                </Button>
              </div>
              <p className="mt-2 text-xs text-ink-faint">{t('setup.token.hint')}</p>
            </div>
          </div>

          {created.device.isDemo ? (
            <div className="mt-6 border-t border-line pt-5">
              <p className="text-sm font-bold text-ink-soft">{t('setup.cmd.title')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <code
                  className="block max-w-full overflow-x-auto rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-xs font-bold break-all text-ink"
                  dir="ltr"
                >
                  {simCommand}
                </code>
                <Button variant="outline" size="sm" onClick={() => void copy(simCommand, 'cmd')}>
                  {copiedCmd ? (
                    <Check className="h-4 w-4 text-safe-ink" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copiedCmd ? t('action.copied') : t('action.copy')}
                </Button>
              </div>
              <div className="mt-4">
                <Button asChild>
                  <Link to="/app">{t('nav.dashboard')}</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          {/* Create a device */}
          <section className="card-soft rounded-2xl p-5 md:p-6">
            <h2 className="text-lg font-extrabold text-ink">{t('setup.title')}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (deviceName.trim()) void onCreate('real')
              }}
              noValidate
              className="mt-4 space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="device-name">{t('dash.device')}</Label>
                <Input
                  id="device-name"
                  type="text"
                  maxLength={60}
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={creating || !deviceName.trim()}>
                {creating ? t('common.loading') : t('action.save')}
              </Button>
            </form>
          </section>

          {/* Join an existing device */}
          <section className="card-soft rounded-2xl p-5 md:p-6">
            <h2 className="text-lg font-extrabold text-ink">{t('setup.pair.code')}</h2>
            <form onSubmit={onPair} noValidate className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pair-code">{t('setup.pair.code')}</Label>
                <Input
                  id="pair-code"
                  type="text"
                  inputMode="text"
                  dir="ltr"
                  className="tnum max-w-[240px] text-start tracking-widest"
                  placeholder="XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <p className="text-xs text-ink-faint">{t('setup.pair.hint')}</p>
              </div>
              <Button type="submit" disabled={!code.trim()}>
                {t('action.add')}
              </Button>
              {joinState === 'ok' ? (
                <p role="status" className="rounded-lg bg-safe-tint px-3 py-2.5 text-sm font-bold text-safe-ink">
                  {t('setup.join.ok')}
                </p>
              ) : null}
              {joinState === 'exists' ? (
                <p role="status" className="rounded-lg bg-watch-tint px-3 py-2.5 text-sm font-bold text-watch-ink">
                  {t('setup.join.exists')}
                </p>
              ) : null}
              {joinState === 'notfound' || joinState === 'error' ? (
                <p role="alert" className="rounded-lg bg-alert-tint px-3 py-2.5 text-sm font-bold text-alert-ink">
                  {t('common.error')}
                </p>
              ) : null}
            </form>
          </section>

          {/* Demo device + simulator */}
          <section className="card-soft rounded-2xl p-5 md:p-6 lg:col-span-2">
            <h2 className="text-lg font-extrabold text-ink">{t('setup.demo.title')}</h2>
            <p className="mt-1.5 text-sm leading-7 text-ink-soft">{t('setup.demo.body')}</p>
            <div className="mt-4">
              <Button variant="outline" onClick={() => void onCreate('demo')} disabled={creating}>
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
                {creating ? t('common.loading') : t('setup.demo.cta')}
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* The path a reading takes, stated plainly */}
      <section className="card-soft mt-6 rounded-2xl p-5 md:p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
          <Radio className="h-5 w-5 text-primary" aria-hidden="true" />
          MQTT
        </h2>
        <ol className="mt-4 grid gap-3 text-sm leading-7 text-ink-soft md:grid-cols-4">
          <li className="rounded-xl border border-line bg-surface-2 p-4">
            1 · Raspberry Pi 4 → <code className="text-xs" dir="ltr">sensa/&lt;deviceId&gt;/readings</code>
          </li>
          <li className="rounded-xl border border-line bg-surface-2 p-4">2 · Mosquitto broker (1883)</li>
          <li className="rounded-xl border border-line bg-surface-2 p-4">3 · Bun ingest → Postgres</li>
          <li className="rounded-xl border border-line bg-surface-2 p-4">4 · {t('brand.name')} → Web Push</li>
        </ol>
      </section>

      <DisclaimerFooter />
    </div>
  )
}
