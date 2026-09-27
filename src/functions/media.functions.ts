import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { imageEditsSchema } from '#/lib/schemas'
import { authMiddleware } from './middleware'
import { getDb, schema } from '#/server/db'
import { applyEdits } from '#/server/render/edit'
import { loadBrand } from '#/server/render/canvas'
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  deleteMedia,
  getMedia,
  readMediaFile,
  saveMedia,
} from '#/server/storage'

export const uploadMediaFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error('Expected form data')
    const file = data.get('file')
    if (!(file instanceof File)) throw new Error('No file uploaded')
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) throw new Error('Only JPG, PNG, WebP or GIF images are allowed')
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('Image is larger than 10 MB')
    return { file, label: String(data.get('label') ?? file.name).slice(0, 120) }
  })
  .handler(async ({ data }) => {
    const buf = Buffer.from(await data.file.arrayBuffer())
    return saveMedia(buf, data.file.type, { kind: 'upload', label: data.label })
  })

export const listMediaFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ kind: z.enum(['upload', 'generated', 'all']).default('all'), limit: z.number().int().max(500).default(120) }))
  .handler(async ({ data }) => {
    const db = await getDb()
    return db
      .select()
      .from(schema.media)
      .where(data.kind === 'all' ? undefined : eq(schema.media.kind, data.kind))
      .orderBy(desc(schema.media.createdAt))
      .limit(data.limit)
  })

export const editMediaFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ mediaId: z.string(), edits: imageEditsSchema }))
  .handler(async ({ data }) => {
    const row = await getMedia(data.mediaId)
    if (!row) throw new Error('Image not found')
    const brand = data.edits.watermark ? await loadBrand() : undefined
    if (data.edits.watermark && !brand?.logo) throw new Error('Upload a logo in Settings to use the watermark.')
    const out = await applyEdits(await readMediaFile(row), data.edits, {
      logo: brand?.logo,
      keepPng: row.mime === 'image/png',
    })
    return saveMedia(out.data, out.mime, {
      kind: 'upload',
      label: `${row.label ?? 'image'} (edited)`,
      width: out.width,
      height: out.height,
    })
  })

export const deleteMediaFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await deleteMedia(data.id)
    return { ok: true }
  })
