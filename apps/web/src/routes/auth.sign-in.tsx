import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

import { authClient } from '#/lib/auth-client'
import { isValidEmail, mapAuthError } from '#/lib/auth-errors'
import { useLocale } from '#/lib/i18n/index'

export const Route = createFileRoute('/auth/sign-in')({ component: SignInPage })

function SignInPage() {
  const { t } = useLocale()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    setFieldError(null)

    if (!email.trim() || !password) {
      setFieldError(t('auth.field.required'))
      return
    }
    if (!isValidEmail(email)) {
      setFieldError(t('auth.field.email'))
      return
    }

    setPending(true)
    const { error } = await authClient.signIn.email({ email: email.trim(), password })
    setPending(false)

    if (error) {
      setFormError(mapAuthError(error, t))
      return
    }
    await navigate({ to: '/app' })
  }

  return (
    <div className="card-soft rounded-2xl p-7 md:p-9">
      <h1 className="text-2xl font-extrabold text-ink">{t('auth.signin.title')}</h1>
      <p className="mt-2 text-sm leading-7 text-ink-soft">{t('auth.signin.subtitle')}</p>

      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="signin-email">{t('auth.email')}</Label>
          <Input
            id="signin-email"
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="signin-password">{t('auth.password')}</Label>
            <Link
              to="/auth/forgot"
              className="inline-flex min-h-8 items-center text-xs font-bold text-primary hover:text-primary-strong"
            >
              {t('auth.forgot.title')}
            </Link>
          </div>
          <Input
            id="signin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {pending ? t('common.loading') : t('action.signin')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {t('auth.noaccount')}{' '}
        <Link
          to="/auth/sign-up"
          className="inline-flex min-h-8 items-center font-bold text-primary hover:text-primary-strong"
        >
          {t('action.signup')}
        </Link>
      </p>
    </div>
  )
}
