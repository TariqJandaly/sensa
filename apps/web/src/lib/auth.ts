import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { prisma } from '#/db'

// Allow-list, never `origin: true`: local dev surfaces today, the real
// domain joins via TRUSTED_ORIGINS at deploy time.
const extraOrigins = (process.env.TRUSTED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export const trustedOrigins = [
  'http://localhost:3123',
  'http://127.0.0.1:3123',
  'http://192.168.68.105:3123',
  ...extraOrigins,
]

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins,
  user: {
    additionalFields: {
      // Server-derived column; filled by the Prisma column default.
      locale: {
        type: 'string',
        required: false,
        input: false,
      },
    },
  },
  // tanstackStartCookies must stay the LAST plugin so sessions reach Set-Cookie.
  plugins: [tanstackStartCookies()],
})
