import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { auth } from '#/lib/auth'
import { prisma } from '#/db'

const unsubscribeSchema = z.object({ endpoint: z.string().url().max(2048) })

export const Route = createFileRoute('/api/push/unsubscribe')({
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
        const parsed = unsubscribeSchema.safeParse(body)
        if (!parsed.success) {
          return Response.json({ error: 'invalid payload' }, { status: 400 })
        }
        await prisma.pushSubscription.deleteMany({
          where: { endpoint: parsed.data.endpoint, userId: session.user.id },
        })
        return Response.json({ ok: true })
      },
    },
  },
})
