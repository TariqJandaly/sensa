import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { ar } from './ar'
import { en } from './en'

export type Locale = 'ar' | 'en'

const dicts: Record<Locale, Record<string, string>> = { ar, en }

interface LocaleContextValue {
  locale: Locale
  t: (key: string, vars?: Record<string, string | number>) => string
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
  initial = 'ar',
  children,
}: {
  initial?: Locale
  children: ReactNode
}) {
  const [locale, setLocaleState] = useState<Locale>(initial)

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    document.cookie = `sensa_locale=${next}; path=/; max-age=31536000; samesite=lax`
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let text = dicts[locale][key] ?? dicts.ar[key] ?? key
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(value))
        }
      }
      return text
    },
    [locale],
  )

  return (
    <LocaleContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used inside LocaleProvider')
  }
  return ctx
}
