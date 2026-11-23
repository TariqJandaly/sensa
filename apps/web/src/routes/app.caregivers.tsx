import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Check, Copy, Plus, X } from 'lucide-react'

import {
  addCaregiver,
  getAppData,
  removeMember,
  setMemberNotify,
} from '#/functions/devices'
import type { AppData, AppMember } from '#/functions/devices'

import { DisclaimerFooter } from '#/components/app-shell'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'

import { copyText } from '#/lib/copy'
import { isValidEmail } from '#/lib/auth-errors'
import { useLocale } from '#/lib/i18n/index'

export const Route = createFileRoute('/app/caregivers')({
  loader: () => getAppData(),
  component: CaregiversPage,
})

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0].charAt(0)}${parts[1].charAt(0)}` : name.charAt(0)
}

function CaregiversPage() {
  const result = Route.useLoaderData()
  const { t } = useLocale()
  const router = useRouter()

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
        <h1 className="text-xl font-extrabold text-ink">{t('cg.empty.title')}</h1>
        <p className="mt-2 text-sm leading-7 text-ink-soft">{t('cg.empty.body')}</p>
        <div className="mt-6">
          <Button asChild size="lg">
            <Link to="/app/setup">{t('action.goSetup')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  const deviceId = data.device.id

  const [members, setMembers] = useState<AppMember[]>(data.members)
  const [notifyState, setNotifyState] = useState<Record<string, boolean>>(
    Object.fromEntries(data.members.map((m) => [m.id, m.notify])),
  )
  const [email, setEmail] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    if (!data.device?.pairingCode) return
    const ok = await copyText(data.device.pairingCode)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault()
    setAddError(null)
    if (!email.trim()) {
      setAddError(t('auth.field.required'))
      return
    }
    if (!isValidEmail(email)) {
      setAddError(t('auth.field.email'))
      return
    }
    setAdding(true)
    const res = await addCaregiver({ data: { deviceId, email: email.trim() } })
    setAdding(false)
    if (!res.ok) {
      const code = (res as { code?: string }).code
      setAddError(
        code === 'EMAIL_UNKNOWN'
          ? t('cg.error.email')
          : code === 'ALREADY_MEMBER'
            ? t('cg.error.already')
            : code === 'SELF'
              ? t('cg.error.self')
              : t('common.error'),
      )
      return
    }
    const member = res.data
    setMembers((prev) => [
      ...prev,
      {
        id: member.id,
        name: member.name,
        email: email.trim().toLowerCase(),
        role: 'CAREGIVER',
        notify: true,
        you: false,
      },
    ])
    setEmail('')
    void router.invalidate()
  }

  async function onNotify(member: AppMember, checked: boolean) {
    setNotifyState((prev) => ({ ...prev, [member.id]: checked }))
    const res = await setMemberNotify({ data: { memberId: member.id, notify: checked } })
    if (!res.ok) {
      setNotifyState((prev) => ({ ...prev, [member.id]: !checked }))
    }
  }

  async function onRemove(member: AppMember) {
    setMembers((prev) => prev.filter((m) => m.id !== member.id))
    const res = await removeMember({ data: { memberId: member.id } })
    if (!res.ok) {
      setMembers((prev) => [...prev, member])
      return
    }
    void router.invalidate()
  }

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t('cg.title')}</h1>
          <p className="mt-1.5 text-sm text-ink-soft">{t('cg.subtitle')}</p>
        </div>
      </header>

      <ul className="card-soft mt-5 divide-y divide-line rounded-2xl">
        {members.length === 0 ? (
          <li className="p-6">
            <p className="text-base font-extrabold text-ink">{t('cg.empty.title')}</p>
            <p className="mt-1.5 text-sm text-ink-soft">{t('cg.empty.body')}</p>
          </li>
        ) : null}
        {members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-3 p-4 md:gap-4 md:p-5">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                member.role === 'WEARER'
                  ? 'bg-primary text-primary-ink'
                  : 'bg-primary-tint text-primary-strong'
              }`}
              aria-hidden="true"
            >
              {initialsOf(member.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-base font-extrabold text-ink">
                {member.name}
                {member.you ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-ink-soft">
                    {t('common.you')}
                  </span>
                ) : null}
              </p>
              <p className="truncate text-sm text-ink-faint" dir="ltr">
                {member.email}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                member.role === 'WEARER' ? 'bg-primary text-primary-ink' : 'bg-muted text-ink-soft'
              }`}
            >
              {t(member.role === 'WEARER' ? 'cg.role.wearer' : 'cg.role.caregiver')}
            </span>
            {member.role === 'CAREGIVER' ? (
              <label className="flex items-center gap-2 text-sm font-bold text-ink-soft">
                <Switch
                  checked={notifyState[member.id] ?? member.notify}
                  onCheckedChange={(checked) => void onNotify(member, checked)}
                />
                <span className="hidden sm:inline">{t('cg.notify')}</span>
                <span className="sr-only sm:hidden">{t('cg.notify')}</span>
              </label>
            ) : null}
            {member.role === 'CAREGIVER' && !member.you ? (
              <button
                type="button"
                onClick={() => void onRemove(member)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-alert-tint hover:text-alert-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{t('action.remove')}</span>
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card-soft rounded-2xl p-5 md:p-6">
          <h2 className="text-lg font-extrabold text-ink">{t('cg.add.title')}</h2>
          <form onSubmit={(e) => void onAdd(e)} noValidate className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cg-email">{t('cg.add.email')}</Label>
              <Input
                id="cg-email"
                type="email"
                inputMode="email"
                dir="ltr"
                className="text-start"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {addError ? <p className="text-sm font-bold text-alert-ink">{addError}</p> : null}
            <Button type="submit" disabled={adding}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {adding ? t('common.loading') : t('action.add')}
            </Button>
            <p className="text-xs leading-6 text-ink-faint">{t('cg.add.hint')}</p>
          </form>
        </section>

        {data.device.pairingCode ? (
          <section className="card-soft rounded-2xl p-5 md:p-6">
            <h2 className="text-lg font-extrabold text-ink">{t('cg.pair.title')}</h2>
            <p className="mt-1.5 text-sm leading-7 text-ink-soft">{t('cg.pair.body')}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span
                className="tnum rounded-xl border border-dashed border-line-strong bg-surface-2 px-5 py-3 text-2xl font-extrabold tracking-widest text-primary-strong"
                dir="ltr"
              >
                {data.device.pairingCode}
              </span>
              <Button variant="outline" onClick={() => void onCopy()}>
                {copied ? (
                  <Check className="h-4 w-4 text-safe-ink" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? t('action.copied') : t('action.copy')}
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      <DisclaimerFooter />
    </div>
  )
}
