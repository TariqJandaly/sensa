import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import { getLocale } from '../functions/data'
import { LocaleProvider } from '#/lib/i18n/index'
import { PwaRegister } from '#/components/pwa-register'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  loader: () => getLocale(),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'سنسا · SENSA' },
      {
        name: 'description',
        content:
          'سنسا: مراقبة مستمرة للمؤشرات الحيوية وتنبيه مبكر عند التغيرات غير الطبيعية. نموذج تعليمي، ليس جهازاً طبياً.',
      },
      { name: 'theme-color', content: '#f5f2ea' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  const locale = Route.useLoaderData()
  return (
    <LocaleProvider initial={locale}>
      <PwaRegister />
      <Outlet />
      <TanStackDevtools
        config={{ position: 'bottom-left' }}
        plugins={[
          { name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> },
          TanStackQueryDevtools,
        ]}
      />
    </LocaleProvider>
  )
}

/** Corrects document direction from the locale cookie before first paint. */
const LOCALE_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )sensa_locale=(ar|en)/);if(m){var l=m[1];document.documentElement.lang=l;document.documentElement.dir=(l==='ar')?'rtl':'ltr';}}catch(e){}`

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: LOCALE_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
