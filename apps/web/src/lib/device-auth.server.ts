import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Device tokens: 32 random bytes, base64url, shown to the wearer exactly
 * once at provisioning. Only the sha256 hash is stored; verification is
 * constant-time.
 */

export function generateDeviceToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function verifyDeviceToken(token: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashDeviceToken(token), 'hex')
  const stored = Buffer.from(storedHash, 'hex')
  if (candidate.length !== stored.length) {
    return false
  }
  return timingSafeEqual(candidate, stored)
}

export function generatePairingCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no lookalikes
  const pick = (n: number) =>
    Array.from(randomBytes(n))
      .map((b) => alphabet[b % alphabet.length])
      .join('')
  return `${pick(4)}-${pick(4)}`
}
