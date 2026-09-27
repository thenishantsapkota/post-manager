import crypto from 'node:crypto'
import {
  deleteCookie,
  getCookie,
  getRequest,
  getRequestIP,
  getRequestProtocol,
  setCookie,
} from '@tanstack/react-start/server'
import { SignJWT } from 'jose'
import { config } from './config'
import { SESSION_COOKIE as COOKIE, secretKey, verifySessionToken } from './session'

const MAX_AGE = 60 * 60 * 24 * 30

function safeEqual(a: string, b: string) {
  const ha = crypto.createHash('sha256').update(a).digest()
  const hb = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

const attempts = new Map<string, { count: number; resetAt: number }>()

function rateLimit(key: string) {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 })
    return
  }
  entry.count++
  if (entry.count > 5) throw new Error('Too many attempts. Wait a minute and try again.')
}

export async function login(password: string) {
  if (!config.adminPassword) {
    throw new Error('ADMIN_PASSWORD is not set on the server. Add it to your .env file.')
  }
  rateLimit(getRequestIP({ xForwardedFor: true }) ?? 'unknown')
  if (!safeEqual(password, config.adminPassword)) throw new Error('Incorrect password')

  const token = await new SignJWT({ sub: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey())
  setCookie(COOKIE, token, {
    httpOnly: true,
    // Only mark Secure when served over HTTPS (directly or behind a proxy);
    // otherwise browsers drop the cookie on plain-HTTP LAN setups like a Pi.
    secure: getRequestProtocol({ xForwardedProto: true }) === 'https',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export function logout() {
  deleteCookie(COOKIE, { path: '/' })
}

export async function isAuthenticated(): Promise<boolean> {
  return verifySessionToken(getCookie(COOKIE))
}

/** Same-origin check for state-changing requests (defence in depth over SameSite). */
function checkOrigin() {
  const req = getRequest()
  if (req.method === 'GET' || req.method === 'HEAD') return
  const origin = req.headers.get('origin')
  if (!origin) return // non-browser clients (curl) don't send Origin and carry no ambient cookie risk
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (new URL(origin).host !== host) throw new Error('Cross-origin request blocked')
}

/** Throws unless the request carries a valid admin session. */
export async function requireAdmin() {
  checkOrigin()
  if (!(await isAuthenticated())) throw new Error('Unauthorized: please log in again.')
}
