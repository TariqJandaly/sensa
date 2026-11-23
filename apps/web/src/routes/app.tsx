import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { getSessionState } from '#/functions/session'

import { AppShell } from '#/components/app-shell'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    // Server-side guard through the RPC bridge: no session, no app.
    const session = await getSessionState()
    if (!session.signedIn) {
      throw redirect({ to: '/auth/sign-in' })
    }
    return { user: { name: session.name, email: session.email } }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
