import { createFileRoute } from '@tanstack/react-router'

import { pushConfigured } from '#/lib/push.server'

export const Route = createFileRoute('/api/push/vapid')({
  server: {
    handlers: {
      GET: () => {
        const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY ?? ''
        if (!pushConfigured) {
          return Response.json({ error: 'push not configured' }, { status: 503 })
        }
        return Response.json({ publicKey })
      },
    },
  },
})
