import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { auth } from '#/lib/auth'
import { prisma } from '#/db'

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
})

export const Route = createFileRoute('/api/push/subscribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return Response.json({ error: 'unauthenticated' }, { status: 401 })
        }
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'invalid JSON' }, { status: 400 })
        }
        const parsed = subscribeSchema.safeParse(body)
        if (!parsed.success) {
          return Response.json({ error: 'invalid subscription' }, { status: 400 })
        }
        const { endpoint, keys } = parsed.data
        // One row per endpoint; re-subscribing refreshes the keys/owner.
        await prisma.pushSubscription.deleteMany({ where: { endpoint } })
        await prisma.pushSubscription.create({
          data: {
            userId: session.user.id,
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
        })
        return Response.json({ ok: true })
      },
    },
  },
})
