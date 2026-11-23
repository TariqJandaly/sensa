import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { buildMockDataset } from '#/lib/mock'
import type { Locale } from '#/lib/i18n/index'

/** The full demo dataset. Replaced by Prisma queries when the device runs. */
export const getSensaData = createServerFn({ method: 'GET' }).handler(async () =>
  buildMockDataset(Date.now()),
)

/** Locale cookie read on the server so SSR renders the right language. */
export const getLocale = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Locale> => {
    try {
      const request = getRequest()
      const cookie = request?.headers.get('cookie') ?? ''
      const match = cookie.match(/(?:^|; )sensa_locale=(ar|en)/)
      return match ? (match[1] as Locale) : 'ar'
    } catch {
      return 'ar'
    }
  },
)
