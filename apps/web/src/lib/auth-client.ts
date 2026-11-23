import { createAuthClient } from 'better-auth/react'

// The server `auth` instance stays out of the client bundle entirely.
// User additional fields (locale) are read server-side; the client only
// drives the Better Auth endpoints: signIn, signUp, signOut, session,
// requestPasswordReset.
export const authClient = createAuthClient()
