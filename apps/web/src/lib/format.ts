import type { Locale } from './i18n/index'

/** Gregorian calendar for Arabic (ar-SA defaults to Hijri for dates). */
function intlLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en'
}

export function formatClock(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatDay(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** Relative time from a fixed ms offset, so SSR and hydration agree. */
export function formatRelative(msAgo: number, locale: Locale): string {
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    numeric: 'auto',
  })
  const seconds = Math.max(0, Math.floor(msAgo / 1000))
  if (seconds < 45) {
    return rtf.format(-seconds, 'second')
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 45) {
    return rtf.format(-minutes, 'minute')
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 22) {
    return rtf.format(-hours, 'hour')
  }
  return rtf.format(-Math.floor(hours / 24), 'day')
}

export function formatNumber(value: number, locale: Locale, decimals = 0): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
