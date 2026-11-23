import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { auth } from '#/lib/auth'

export interface SessionState {
  signedIn: boolean
  id: string | null
  name: string | null
  email: string | null
}

/**
 * Session probe for route guards. Called via the RPC bridge so no
 * server-only import ever reaches a client-reachable route file.
 */
export const getSessionState = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionState> => {
    try {
      const request = getRequest()
      if (!request) {
        return { signedIn: false, id: null, name: null, email: null }
      }
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) {
        return { signedIn: false, id: null, name: null, email: null }
      }
      return {
        signedIn: true,
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      }
    } catch {
      return { signedIn: false, id: null, name: null, email: null }
    }
  },
)
