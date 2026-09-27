import { and, asc, desc, eq, inArray, lt, lte } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { PostStatus } from '#/lib/types'
import { getDb, schema } from './db'
import type { Post } from './db/schema'
import { FacebookError, publishToPage } from './facebook'
import { getPageCredentials, logActivity } from './settings'
import { getMediaMany, readMediaFile } from './storage'

const MAX_ATTEMPTS = 3

export interface NewPost {
  title?: string | null
  caption: string
  mediaIds: string[]
  status: Extract<PostStatus, 'draft' | 'scheduled'>
  scheduledAt?: number | null
  source?: Post['source']
  automationId?: string | null
}

export async function createPost(input: NewPost): Promise<Post> {
  const db = await getDb()
  const now = Date.now()
  const row: Post = {
    id: nanoid(10),
    title: input.title ?? null,
    caption: input.caption,
    mediaIds: input.mediaIds,
    status: input.status,
    scheduledAt: input.status === 'scheduled' ? (input.scheduledAt ?? now) : (input.scheduledAt ?? null),
    publishedAt: null,
    fbPostId: null,
    permalink: null,
    error: null,
    attempts: 0,
    source: input.source ?? 'manual',
    automationId: input.automationId ?? null,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.posts).values(row)
  return row
}

export async function getPost(id: string) {
  const db = await getDb()
  return db.query.posts.findFirst({ where: eq(schema.posts.id, id) })
}

export async function updatePost(id: string, patch: Partial<Omit<Post, 'id' | 'createdAt'>>) {
  const db = await getDb()
  await db
    .update(schema.posts)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(schema.posts.id, id))
}

export async function listPosts(opts: { statuses?: PostStatus[]; limit?: number }) {
  const db = await getDb()
  const where = opts.statuses?.length ? inArray(schema.posts.status, opts.statuses) : undefined
  return db
    .select()
    .from(schema.posts)
    .where(where)
    .orderBy(desc(schema.posts.updatedAt))
    .limit(opts.limit ?? 200)
}

export async function upcomingPosts(limit = 10) {
  const db = await getDb()
  return db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.status, 'scheduled'))
    .orderBy(asc(schema.posts.scheduledAt))
    .limit(limit)
}

/**
 * Claim a post for publishing. The conditional update makes this safe if two
 * ticks (in-process timer and external cron) race for the same post.
 */
async function claim(id: string): Promise<Post | undefined> {
  const db = await getDb()
  const rows = await db
    .update(schema.posts)
    .set({ status: 'publishing', updatedAt: Date.now() })
    .where(and(eq(schema.posts.id, id), inArray(schema.posts.status, ['scheduled', 'draft', 'failed'])))
    .returning()
  return rows[0]
}

async function publishClaimed(post: Post): Promise<Post> {
  const label = post.title || post.caption.slice(0, 40) || post.id
  try {
    const { pageId, token } = await getPageCredentials()
    const media = await getMediaMany(post.mediaIds)
    if (media.length !== post.mediaIds.length) {
      throw new Error('One or more images for this post were deleted.')
    }
    const images = await Promise.all(
      media.map(async (m) => ({ data: await readMediaFile(m), mime: m.mime, filename: m.filename })),
    )
    const res = await publishToPage({ pageId, token, message: post.caption, images })
    const patch = {
      status: 'published' as const,
      publishedAt: Date.now(),
      fbPostId: res.postId,
      permalink: res.permalink ?? null,
      error: null,
      attempts: post.attempts + 1,
    }
    await updatePost(post.id, patch)
    await logActivity('success', `Published “${label}” to Facebook`)
    return { ...post, ...patch }
  } catch (err) {
    const message = (err as Error).message
    const attempts = post.attempts + 1
    // Auth/config errors will not fix themselves; don't burn retries on them.
    const permanent =
      (err instanceof FacebookError && err.isAuthError) || message.includes('not connected') || message.includes('deleted')
    const retry = !permanent && attempts < MAX_ATTEMPTS
    const patch = retry
      ? { status: 'scheduled' as const, attempts, error: message, scheduledAt: Date.now() + attempts * 5 * 60_000 }
      : { status: 'failed' as const, attempts, error: message }
    await updatePost(post.id, patch)
    await logActivity(
      'error',
      `Failed to publish “${label}”: ${message}${retry ? ` (retrying in ${attempts * 5} min)` : ''}`,
    )
    return { ...post, ...patch }
  }
}

export async function publishNow(id: string) {
  const post = await claim(id)
  if (!post) throw new Error('This post is already publishing or has been published.')
  return publishClaimed({ ...post, attempts: post.status === 'failed' ? 0 : post.attempts })
}

export async function publishDuePosts() {
  const db = await getDb()
  const due = await db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(and(eq(schema.posts.status, 'scheduled'), lte(schema.posts.scheduledAt, Date.now())))
    .orderBy(asc(schema.posts.scheduledAt))
    .limit(10)
  for (const { id } of due) {
    const db2 = await getDb()
    const rows = await db2
      .update(schema.posts)
      .set({ status: 'publishing', updatedAt: Date.now() })
      .where(and(eq(schema.posts.id, id), eq(schema.posts.status, 'scheduled')))
      .returning()
    if (rows[0]) await publishClaimed(rows[0])
  }
  return due.length
}

/**
 * A post stuck in "publishing" means the process died mid-upload. We can't
 * know whether Facebook received it, so mark it failed rather than risk a
 * duplicate post; the user can retry from the UI.
 */
export async function recoverStuckPosts() {
  const db = await getDb()
  const stuck = await db
    .update(schema.posts)
    .set({
      status: 'failed',
      error: 'Publishing was interrupted (server restarted). Check the page, then retry if it did not post.',
      updatedAt: Date.now(),
    })
    .where(and(eq(schema.posts.status, 'publishing'), lt(schema.posts.updatedAt, Date.now() - 10 * 60_000)))
    .returning({ id: schema.posts.id })
  if (stuck.length) await logActivity('error', `${stuck.length} post(s) were interrupted while publishing`)
}
