import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { heartbeatSchema } from '@sensa/contracts'

import { deviceTokenFromRequest, ingestHeartbeat } from '#/lib/alerts.server'

const bodySchema = z.object({ deviceId: z.string().min(1) }).and(heartbeatSchema)

export const Route = createFileRoute('/api/ingest/heartbeat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = deviceTokenFromRequest(request)
        if (!token) {
          return Response.json({ error: 'missing device token' }, { status: 401 })
        }
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'invalid JSON' }, { status: 400 })
        }
        const parsed = bodySchema.safeParse(body)
        if (!parsed.success) {
          return Response.json({ error: 'invalid heartbeat' }, { status: 400 })
        }
        const { deviceId, ...heartbeat } = parsed.data
        const result = await ingestHeartbeat(token, deviceId, heartbeat)
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: result.status })
        }
        return Response.json({ accepted: 1 })
      },
    },
  },
})
