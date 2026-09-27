import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { SIGN_KEYS } from '#/lib/signs'
import { RASHIFAL_PERIODS } from '#/lib/types'
import { authMiddleware } from './middleware'
import { createPost, publishNow } from '#/server/posts'
import {
  buildRashifalCaption,
  buildRashifalPost,
  coverFooter,
  currentSet,
  effectiveFormat,
  getSet,
  listSets,
  renderContext,
  saveSetEdits,
  setSubtitle,
  syncRashifal,
} from '#/server/rashifal'
import { getSettings, logActivity } from '#/server/settings'
import { listTemplates, renderRashifalCoverImage, renderRashifalSign } from '#/server/templates'

export const getRashifalOverviewFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    // Refresh (throttled) so the page shows today's data without a manual click.
    let syncError: string | null = null
    try {
      await syncRashifal()
    } catch (err) {
      syncError = (err as Error).message
    }
    const s = await getSettings()
    const sets = await listSets(30)
    const current = Object.fromEntries(
      await Promise.all(RASHIFAL_PERIODS.map(async (p) => [p, (await currentSet(p))?.id ?? null] as const)),
    )
    const templates = (await listTemplates())
      .filter((t) => t.kind === 'rashifal_sign' || t.kind === 'rashifal_cover')
      .map((t) => ({ id: t.id, name: t.name, kind: t.kind }))
    return {
      sets: sets.map((set) => ({ ...set, subtitle: setSubtitle(set) })),
      current,
      syncError,
      signTemplateId: s.rashifalSignTemplateId,
      coverTemplateId: s.rashifalCoverTemplateId,
      templates,
    }
  })

export const syncRashifalFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async () => {
    const res = await syncRashifal(true)
    await logActivity('info', `Fetched ${res.count} rashifal sets from Nepali Patro`)
    return res
  })

export const saveRashifalEditsFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({ id: z.string(), entries: z.record(z.enum(SIGN_KEYS), z.string().max(8000)) }),
  )
  .handler(async ({ data }) => {
    await saveSetEdits(data.id, data.entries)
    return { ok: true }
  })

export const previewRashifalCaptionFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const set = await getSet(data.id)
    if (!set) throw new Error('Rashifal set not found')
    const s = await getSettings()
    return { caption: buildRashifalCaption(s.rashifalCaption, set, { brand: s.brandName, hashtags: s.hashtags }) }
  })

export const createRashifalPostFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string(),
      format: z.enum(['album', 'cover']),
      mode: z.enum(['draft', 'schedule', 'now']),
      scheduledAt: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (data.mode === 'schedule' && (!data.scheduledAt || data.scheduledAt < Date.now() - 60_000)) {
      throw new Error('Pick a future date and time.')
    }
    const set = await getSet(data.id)
    if (!set) throw new Error('Rashifal set not found')
    const built = await buildRashifalPost(set, data.format)
    const post = await createPost({
      ...built,
      status: data.mode === 'draft' ? 'draft' : 'scheduled',
      scheduledAt: data.mode === 'schedule' ? data.scheduledAt : Date.now(),
    })
    if (data.mode === 'now') return publishNow(post.id)
    return post
  })

/** Exact render of one image of a set (a sign card or the cover), as a data URL. */
export const previewRashifalImageFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), sign: z.enum(SIGN_KEYS).nullable(), format: z.enum(['album', 'cover']) }))
  .handler(async ({ data }) => {
    const set = await getSet(data.id)
    if (!set) throw new Error('Rashifal set not found')
    const ctx = renderContext(set)
    const footer = coverFooter(effectiveFormat(set.period, data.format))
    const img = data.sign
      ? await renderRashifalSign(ctx, data.sign, set.entries[data.sign])
      : await renderRashifalCoverImage(ctx, footer)
    return { dataUrl: `data:${img.mime};base64,${img.data.toString('base64')}` }
  })
