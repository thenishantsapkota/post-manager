import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { isAuthenticated, login, logout } from '#/server/auth'

export const getSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  return { authenticated: await isAuthenticated() }
})

export const loginFn = createServerFn({ method: 'POST' })
  .validator(z.object({ password: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    await login(data.password)
    return { ok: true }
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(() => {
  logout()
  return { ok: true }
})
