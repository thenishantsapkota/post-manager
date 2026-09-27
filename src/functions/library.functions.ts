import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { cardSpecSchema } from '#/lib/schemas'
import { authMiddleware } from './middleware'
import { getDb, schema } from '#/server/db'

export const listLibraryFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const db = await getDb()
    return db
      .select()
      .from(schema.libraryItems)
      .orderBy(asc(schema.libraryItems.collection), asc(schema.libraryItems.createdAt))
  })

export const saveLibraryItemFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string().nullable(),
      collection: z.string().trim().min(1).max(60),
      caption: z.string().max(60000),
      mediaId: z.string().nullable(),
      card: cardSpecSchema.nullable(),
      active: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    if (!data.caption.trim() && !data.mediaId && !data.card) {
      throw new Error('Add a caption, an image, or a designed card.')
    }
    const db = await getDb()
    const values = {
      collection: data.collection,
      caption: data.caption,
      mediaId: data.card ? null : data.mediaId,
      card: data.card,
      active: data.active,
    }
    if (data.id) {
      await db.update(schema.libraryItems).set(values).where(eq(schema.libraryItems.id, data.id))
      return { id: data.id }
    }
    const id = nanoid(10)
    await db.insert(schema.libraryItems).values({ ...values, id, createdAt: Date.now() })
    return { id }
  })

export const deleteLibraryItemFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const db = await getDb()
    await db.delete(schema.libraryItems).where(eq(schema.libraryItems.id, data.id))
    return { ok: true }
  })
