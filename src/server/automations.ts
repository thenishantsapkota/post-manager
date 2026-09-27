import { and, asc, eq, lte } from 'drizzle-orm'
import { Cron } from 'croner'
import { nanoid } from 'nanoid'
import { NEPAL_TZ } from '#/lib/time'
import { PERIOD_LABELS } from '#/lib/types'
import type { AutomationConfig } from '#/lib/types'
import { getDb, schema } from './db'
import type { Automation } from './db/schema'
import { createPost } from './posts'
import { buildRashifalPost, currentSet, setKey, syncRashifal } from './rashifal'
import { logActivity } from './settings'
import { renderCardToMedia } from './templates'

/** Runs later than this after their slot are skipped instead of posted late. */
const MAX_LATENESS_MS = 2 * 60 * 60_000
/** How long to keep retrying while waiting for Nepali Patro to publish. */
const MAX_WAIT_MS = 6 * 60 * 60_000
const RETRY_EVERY_MS = 15 * 60_000

/** Content isn't available yet; try again shortly. */
class RetryLater extends Error {}
/** Nothing to do this time (e.g. this week's rashifal was already posted). */
class Skip extends Error {}

export function nextRun(cron: string, from = new Date()): number | null {
  const next = new Cron(cron, { timezone: NEPAL_TZ, paused: true }).nextRun(from)
  return next ? next.getTime() : null
}

export function validateCron(cron: string) {
  try {
    new Cron(cron, { timezone: NEPAL_TZ, paused: true })
  } catch (err) {
    throw new Error(`Invalid schedule: ${(err as Error).message}`)
  }
}

export async function listAutomations() {
  const db = await getDb()
  return db.select().from(schema.automations).orderBy(asc(schema.automations.createdAt))
}

export interface AutomationInput {
  name: string
  cron: string
  enabled: boolean
  config: AutomationConfig
}

export async function saveAutomation(id: string | null, input: AutomationInput) {
  validateCron(input.cron)
  const db = await getDb()
  const now = Date.now()
  const values = {
    name: input.name,
    kind: input.config.kind,
    cron: input.cron,
    enabled: input.enabled,
    config: input.config,
    nextRunAt: input.enabled ? nextRun(input.cron) : null,
    pendingSlotAt: null,
    updatedAt: now,
  }
  if (id) {
    await db.update(schema.automations).set(values).where(eq(schema.automations.id, id))
    return id
  }
  const newId = nanoid(10)
  await db.insert(schema.automations).values({ ...values, id: newId, createdAt: now })
  return newId
}

export async function deleteAutomation(id: string) {
  const db = await getDb()
  await db.delete(schema.automations).where(eq(schema.automations.id, id))
}

async function pickLibraryItem(collection: string, order: 'sequential' | 'random') {
  const db = await getDb()
  const items = await db
    .select()
    .from(schema.libraryItems)
    .where(and(eq(schema.libraryItems.collection, collection), eq(schema.libraryItems.active, true)))
  if (items.length === 0) return undefined
  if (order === 'random') {
    // Random among the least-posted so everything gets a turn.
    const min = Math.min(...items.map((i) => i.timesPosted))
    const pool = items.filter((i) => i.timesPosted === min)
    return pool[Math.floor(Math.random() * pool.length)]
  }
  return items.sort((a, b) => a.timesPosted - b.timesPosted || a.createdAt - b.createdAt)[0]
}

/** Execute one automation: produce a post scheduled for right now. */
async function runAutomation(a: Automation, opts: { force: boolean }): Promise<string> {
  const db = await getDb()
  const cfg = a.config
  if (cfg.kind === 'rashifal') {
    await syncRashifal(true)
    const set = await currentSet(cfg.period)
    const label = PERIOD_LABELS[cfg.period].toLowerCase()
    if (!set) throw new RetryLater(`Nepali Patro hasn't published the ${label} rashifal yet`)
    if (!opts.force && a.lastSetKey === setKey(set)) {
      throw new Skip(`This ${label} rashifal was already posted`)
    }
    const built = await buildRashifalPost(set, cfg.format)
    const post = await createPost({ ...built, status: 'scheduled', source: 'automation', automationId: a.id })
    await db.update(schema.automations).set({ lastSetKey: setKey(set) }).where(eq(schema.automations.id, a.id))
    return post.id
  }

  const item = await pickLibraryItem(cfg.collection, cfg.order)
  if (!item) throw new Error(`Library collection “${cfg.collection}” has no active items.`)
  const mediaIds: string[] = []
  if (item.card) mediaIds.push((await renderCardToMedia(item.card, `${cfg.collection} card`)).id)
  else if (item.mediaId) mediaIds.push(item.mediaId)
  const post = await createPost({
    title: a.name,
    caption: item.caption,
    mediaIds,
    status: 'scheduled',
    source: 'automation',
    automationId: a.id,
  })
  await db
    .update(schema.libraryItems)
    .set({ timesPosted: item.timesPosted + 1, lastPostedAt: Date.now() })
    .where(eq(schema.libraryItems.id, item.id))
  return post.id
}

async function record(
  a: Automation,
  status: 'ok' | 'error' | 'skipped',
  message: string,
  extra: Partial<Automation> = {},
) {
  const db = await getDb()
  await db
    .update(schema.automations)
    .set({ lastStatus: status, lastMessage: message, lastRunAt: Date.now(), ...extra })
    .where(eq(schema.automations.id, a.id))
}

export async function runAutomationNow(id: string) {
  const db = await getDb()
  const a = await db.query.automations.findFirst({ where: eq(schema.automations.id, id) })
  if (!a) throw new Error('Automation not found')
  try {
    const postId = await runAutomation(a, { force: true })
    await record(a, 'ok', 'Ran manually')
    await logActivity('info', `Ran automation “${a.name}” manually`)
    return postId
  } catch (err) {
    await record(a, 'error', (err as Error).message)
    throw err
  }
}

export async function runDueAutomations() {
  const db = await getDb()
  const now = Date.now()
  const due = await db
    .select()
    .from(schema.automations)
    .where(and(eq(schema.automations.enabled, true), lte(schema.automations.nextRunAt, now)))

  for (const a of due) {
    const slot = a.pendingSlotAt ?? a.nextRunAt!
    const upcoming = nextRun(a.cron, new Date(now))
    // Advance the schedule first (conditionally) so a crash or a racing tick
    // can never run the same slot twice.
    const claimed = await db
      .update(schema.automations)
      .set({ nextRunAt: upcoming, pendingSlotAt: null })
      .where(and(eq(schema.automations.id, a.id), eq(schema.automations.nextRunAt, a.nextRunAt!)))
      .returning({ id: schema.automations.id })
    if (!claimed.length) continue

    if (!a.pendingSlotAt && now - slot > MAX_LATENESS_MS) {
      await record(a, 'skipped', 'Missed its slot by more than 2 hours (server was offline)')
      await logActivity('info', `Skipped late run of “${a.name}”`)
      continue
    }
    try {
      await runAutomation(a, { force: false })
      await record(a, 'ok', 'Created post')
      await logActivity('info', `Automation “${a.name}” created a post`)
    } catch (err) {
      const message = (err as Error).message
      if (err instanceof Skip) {
        await record(a, 'skipped', message)
      } else if (err instanceof RetryLater && now - slot < MAX_WAIT_MS) {
        const retryAt = now + RETRY_EVERY_MS
        // Retry soon, unless the next regular slot comes first.
        if (!upcoming || retryAt < upcoming) {
          await record(a, 'skipped', `${message} — retrying in 15 min`, { nextRunAt: retryAt, pendingSlotAt: slot })
        } else {
          await record(a, 'skipped', message)
        }
      } else {
        await record(a, 'error', message)
        await logActivity('error', `Automation “${a.name}” failed: ${message}`)
      }
    }
  }
}
