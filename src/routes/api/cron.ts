import crypto from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { config } from '#/server/config'
import { tick } from '#/server/scheduler'

// Optional external trigger (cron-job.org, systemd timer, etc.) for hosts
// where the in-process scheduler can't stay alive:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron
async function handle(request: Request) {
  const secret = config.cronSecret
  if (!secret) return new Response('CRON_SECRET is not configured', { status: 404 })
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const a = crypto.createHash('sha256').update(given).digest()
  const b = crypto.createHash('sha256').update(secret).digest()
  if (!crypto.timingSafeEqual(a, b)) return new Response('Unauthorized', { status: 401 })
  await tick()
  return Response.json({ ok: true, at: new Date().toISOString() })
}

export const Route = createFileRoute('/api/cron')({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
})
