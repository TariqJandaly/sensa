import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

import { authClient } from '#/lib/auth-client'
import { isValidEmail, mapAuthError } from '#/lib/auth-errors'
import { useLocale } from '#/lib/i18n/index'

export const Route = createFileRoute('/auth/forgot')({ component: ForgotPage })

function ForgotPage() {
  const { t } = useLocale()

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFieldError(null)
    setFormError(null)

    if (!email.trim()) {
      setFieldError(t('auth.field.required'))
      return
    }
    if (!isValidEmail(email)) {
      setFieldError(t('auth.field.email'))
      return
    }

    setPending(true)
    const { error } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: `${window.location.origin}/auth/sign-in`,
    })
    setPending(false)

    if (error) {
      setFormError(mapAuthError(error, t))
      return
    }
    setSent(true)
  }

  return (
    <div className="card-soft rounded-2xl p-7 md:p-9">
      <h1 className="text-2xl font-extrabold text-ink">{t('auth.forgot.title')}</h1>
      <p className="mt-2 text-sm leading-7 text-ink-soft">{t('auth.forgot.subtitle')}</p>

      {sent ? (
        <div className="mt-7 rounded-xl bg-safe-tint px-4 py-4">
          <p className="text-sm font-bold leading-7 text-safe-ink">{t('auth.forgot.sent')}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-7 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">{t('auth.email')}</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              dir="ltr"
              className="text-start"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {fieldError ? <p className="text-sm font-bold text-alert-ink">{fieldError}</p> : null}
          {formError ? (
            <p role="alert" className="rounded-lg bg-alert-tint px-3 py-2.5 text-sm font-bold text-alert-ink">
              {formError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? t('common.loading') : t('action.send')}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm">
        <Link
          to="/auth/sign-in"
          className="inline-flex min-h-8 items-center font-bold text-primary hover:text-primary-strong"
        >
          {t('action.back')}
        </Link>
      </p>
    </div>
  )
}
