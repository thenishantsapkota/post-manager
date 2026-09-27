import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { automationConfigSchema } from '#/lib/schemas'
import { authMiddleware } from './middleware'
import {
  deleteAutomation,
  listAutomations,
  nextRun,
  runAutomationNow,
  saveAutomation,
} from '#/server/automations'
import { getDb, schema } from '#/server/db'
import { tick } from '#/server/scheduler'

export const listAutomationsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const db = await getDb()
    const automations = await listAutomations()
    const collections = await db
      .selectDistinct({ collection: schema.libraryItems.collection })
      .from(schema.libraryItems)
    return { automations, collections: collections.map((c) => c.collection) }
  })

export const saveAutomationFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string().nullable(),
      name: z.string().trim().min(1).max(80),
      cron: z.string().trim().min(9).max(100),
      enabled: z.boolean(),
      config: automationConfigSchema,
    }),
  )
  .handler(async ({ data }) => ({ id: await saveAutomation(data.id, data) }))

export const toggleAutomationFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), enabled: z.boolean() }))
  .handler(async ({ data }) => {
    const db = await getDb()
    const a = await db.query.automations.findFirst({ where: eq(schema.automations.id, data.id) })
    if (!a) throw new Error('Automation not found')
    await db
      .update(schema.automations)
      .set({
        enabled: data.enabled,
        nextRunAt: data.enabled ? nextRun(a.cron) : null,
        pendingSlotAt: null,
        updatedAt: Date.now(),
      })
      .where(eq(schema.automations.id, data.id))
    return { ok: true }
  })

export const deleteAutomationFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await deleteAutomation(data.id)
    return { ok: true }
  })

export const runAutomationNowFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const postId = await runAutomationNow(data.id)
    await tick() // publish the new post right away
    return { postId }
  })

export const previewScheduleFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ cron: z.string().max(100) }))
  .handler(async ({ data }) => {
    try {
      const runs: number[] = []
      let from = new Date()
      for (let i = 0; i < 3; i++) {
        const n = nextRun(data.cron, from)
        if (!n) break
        runs.push(n)
        from = new Date(n + 1000)
      }
      return { ok: true as const, runs }
    } catch (err) {
      return { ok: false as const, error: (err as Error).message }
    }
  })
