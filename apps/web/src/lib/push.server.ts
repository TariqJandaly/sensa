import { setVapidDetails, sendNotification } from 'web-push'

/**
 * Web Push delivery. VAPID keys live in .env.local; the public key is
 * served to browsers at /api/push/vapid and browsers subscribe at
 * /api/push/subscribe.
 */

const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY ?? ''
const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY ?? ''
const subject = process.env.PUSH_VAPID_SUBJECT ?? 'mailto:admin@sensa.local'

export const pushConfigured = Boolean(publicKey && privateKey)

if (pushConfigured) {
  setVapidDetails(subject, publicKey, privateKey)
}

export interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
}

export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<{ ok: boolean; gone?: boolean }> {
  if (!pushConfigured) {
    return { ok: false }
  }
  try {
    await sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 300, urgency: 'high' },
    )
    return { ok: true }
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    if (statusCode === 404 || statusCode === 410) {
      // Subscription is dead; caller should remove it.
      return { ok: false, gone: true }
    }
    return { ok: false }
  }
}
