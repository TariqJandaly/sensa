import { createFileRoute } from '@tanstack/react-router'

import { readingBatchSchema } from '@sensa/contracts'

import { deviceTokenFromRequest, ingestReadings } from '#/lib/alerts.server'

export const Route = createFileRoute('/api/ingest/readings')({
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
        const parsed = readingBatchSchema.safeParse(body)
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? 'invalid batch' },
            { status: 400 },
          )
        }
        const result = await ingestReadings(token, parsed.data)
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: result.status })
        }
        return Response.json({ accepted: result.accepted, alertsRaised: result.alertsRaised })
      },
    },
  },
})
