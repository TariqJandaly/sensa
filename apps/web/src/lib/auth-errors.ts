type TFn = (key: string) => string

interface BetterAuthErrorShape {
  status?: number
  code?: string
  message?: string
}

/** Maps Better Auth error codes to honest, actionable copy. */
export function mapAuthError(error: BetterAuthErrorShape | null | undefined, t: TFn): string {
  if (!error) {
    return t('auth.error.generic')
  }
  if (error.status === 429) {
    return t('auth.error.rate')
  }
  const code = (error.code ?? '').toUpperCase()
  switch (code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
    case 'INVALID_PASSWORD':
    case 'INVALID_EMAIL':
      return t('auth.error.invalid')
    case 'USER_ALREADY_EXISTS':
      return t('auth.error.exists')
    case 'WEAK_PASSWORD':
    case 'PASSWORD_TOO_SHORT':
      return t('auth.error.weak')
    default:
      return t('auth.error.generic')
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
