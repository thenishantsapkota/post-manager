import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { cardSpecSchema } from '#/lib/schemas'
import { authMiddleware } from './middleware'
import { getDb, schema } from '#/server/db'
import { createPost, getPost, listPosts, publishNow, updatePost } from '#/server/posts'
import { getMediaMany } from '#/server/storage'
import { renderCard, renderCardToMedia } from '#/server/templates'

const statusEnum = z.enum(['draft', 'scheduled', 'publishing', 'published', 'failed'])

export const listPostsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ status: statusEnum.optional() }))
  .handler(async ({ data }) => listPosts({ statuses: data.status ? [data.status] : undefined }))

export const getPostFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const post = await getPost(data.id)
    if (!post) throw new Error('Post not found')
    return { post, media: await getMediaMany(post.mediaIds) }
  })

export const savePostFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string().optional(),
      title: z.string().max(120).optional(),
      caption: z.string().max(60000),
      mediaIds: z.array(z.string()).max(30),
      mode: z.enum(['draft', 'schedule', 'now']),
      scheduledAt: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (!data.caption.trim() && data.mediaIds.length === 0) {
      throw new Error('Add a caption or at least one image.')
    }
    if (data.mode === 'schedule') {
      if (!data.scheduledAt) throw new Error('Pick a date and time to schedule.')
      if (data.scheduledAt < Date.now() - 60_000) throw new Error('The scheduled time is in the past.')
    }
    const status = data.mode === 'draft' ? ('draft' as const) : ('scheduled' as const)
    const scheduledAt =
      data.mode === 'schedule' ? data.scheduledAt! : data.mode === 'now' ? Date.now() : (data.scheduledAt ?? null)

    let id = data.id
    if (id) {
      const existing = await getPost(id)
      if (!existing) throw new Error('Post not found')
      if (existing.status === 'published' || existing.status === 'publishing') {
        throw new Error('Published posts cannot be edited here. Edit them on Facebook.')
      }
      await updatePost(id, {
        title: data.title ?? null,
        caption: data.caption,
        mediaIds: data.mediaIds,
        status,
        scheduledAt,
        error: null,
        attempts: 0,
      })
    } else {
      id = (await createPost({ title: data.title, caption: data.caption, mediaIds: data.mediaIds, status, scheduledAt })).id
    }

    if (data.mode === 'now') return publishNow(id)
    return (await getPost(id))!
  })

export const publishNowFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => publishNow(data.id))

export const unschedulePostFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const post = await getPost(data.id)
    if (post?.status !== 'scheduled' && post?.status !== 'failed') {
      throw new Error('Only scheduled or failed posts can be moved to drafts.')
    }
    await updatePost(data.id, { status: 'draft' })
    return { ok: true }
  })

export const deletePostFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const post = await getPost(data.id)
    if (post?.status === 'publishing') throw new Error('This post is publishing right now.')
    const db = await getDb()
    await db.delete(schema.posts).where(eq(schema.posts.id, data.id))
    return { ok: true }
  })

/** Render a card (custom template or built-in) into a new media item. */
export const renderCardFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ spec: cardSpecSchema, label: z.string().max(120).optional() }))
  .handler(async ({ data }) => renderCardToMedia(data.spec, data.label ?? 'Designed card'))

/** Render a card without saving it; returns a data URL for previews. */
export const previewCardFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ spec: cardSpecSchema }))
  .handler(async ({ data }) => {
    const img = await renderCard(data.spec)
    return { dataUrl: `data:${img.mime};base64,${img.data.toString('base64')}` }
  })
