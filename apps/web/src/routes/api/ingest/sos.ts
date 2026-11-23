import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { sosEventSchema } from '@sensa/contracts'

import { deviceTokenFromRequest, ingestSos } from '#/lib/alerts.server'

const bodySchema = z.object({ deviceId: z.string().min(1) }).and(sosEventSchema)

export const Route = createFileRoute('/api/ingest/sos')({
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
          return Response.json({ error: 'invalid SOS payload' }, { status: 400 })
        }
        const { deviceId, ...sos } = parsed.data
        const result = await ingestSos(token, deviceId, sos)
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: result.status })
        }
        return Response.json({ accepted: 1 })
      },
    },
  },
})
