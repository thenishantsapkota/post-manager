import { defineHandler, getCookie, getRouterParam } from 'nitro/h3'
import { SESSION_COOKIE, verifySessionToken } from '../server/session'
import { getMedia, readMediaFile } from '../server/storage'

// Serves stored images at /api/media/:id to logged-in users.
// This is a Nitro handler rather than a TanStack server route because Nitro's
// dev server treats <img> requests (Sec-Fetch-Dest: image) as static files
// unless a Nitro route claims the path.
export default defineHandler(async (event) => {
  if (!(await verifySessionToken(getCookie(event, SESSION_COOKIE)))) {
    return new Response('Unauthorized', { status: 401 })
  }
  const id = getRouterParam(event, 'id') ?? ''
  const row = /^[A-Za-z0-9_-]{6,32}$/.test(id) ? await getMedia(id) : undefined
  if (!row) return new Response('Not found', { status: 404 })
  const data = await readMediaFile(row).catch(() => null)
  if (!data) return new Response('File missing', { status: 404 })
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': row.mime,
      // Media is immutable (edits create new ids).
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
