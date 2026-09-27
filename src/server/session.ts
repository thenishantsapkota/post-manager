import crypto from 'node:crypto'
import { jwtVerify } from 'jose'
import { config } from './config'

// Framework-free session helpers, shared by TanStack server functions and the
// Nitro media handler.

export const SESSION_COOKIE = 'damak_session'

export function secretKey() {
  // Derive from ADMIN_PASSWORD when SESSION_SECRET is unset, so changing the
  // password also logs out every existing session.
  const raw = config.sessionSecret || `derived:${config.adminPassword}`
  return crypto.createHash('sha256').update(raw).digest()
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !config.adminPassword) return false
  try {
    await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    return true
  } catch {
    return false
  }
}
