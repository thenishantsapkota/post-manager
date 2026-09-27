import { createMiddleware } from '@tanstack/react-start'
import { requireAdmin } from '#/server/auth'

/**
 * Attach to every server function that touches private data. The `.server()`
 * body is stripped from client bundles, so the server-only import goes with it.
 */
export const authMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  await requireAdmin()
  return next()
})
