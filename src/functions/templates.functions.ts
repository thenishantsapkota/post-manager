import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { imageCredit } from '#/lib/credit'
import { templateDataSchema, templateInputSchema } from '#/lib/schemas'
import { sampleVars } from '#/lib/template-vars'
import { authMiddleware } from './middleware'
import { loadBrand } from '#/server/render/canvas'
import { renderTemplate } from '#/server/render/engine'
import { getSettings, saveSettings } from '#/server/settings'
import { baseVars, deleteTemplate, getTemplate, listTemplates, saveTemplate, toTemplateData } from '#/server/templates'
import { nptDateKey } from '#/lib/time'

export const listTemplatesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const s = await getSettings()
    const rows = await listTemplates()
    return rows.map((t) => ({
      ...t,
      isRashifalDefault: t.id === s.rashifalSignTemplateId || t.id === s.rashifalCoverTemplateId,
    }))
  })

export const getTemplateFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const row = await getTemplate(data.id)
    if (!row) throw new Error('Template not found')
    return { id: row.id, ...toTemplateData(row) }
  })

export const saveTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().nullable(), data: templateDataSchema }))
  .handler(async ({ data }) => ({ id: await saveTemplate(data.id, data.data) }))

/**
 * Render an unsaved template exactly as the server will render it for real,
 * with sample values for anything not supplied. Returns a data URL.
 */
export const previewTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ data: templateDataSchema, input: templateInputSchema }))
  .handler(async ({ data }) => {
    const brand = await loadBrand()
    const samples = sampleVars(data.data.kind)
    const vars = { ...samples, ...baseVars(nptDateKey(), brand), ...data.input.vars }
    const isRashifal = data.data.kind !== 'general'
    const img = await renderTemplate(data.data, { ...data.input, vars }, brand, {
      credit: isRashifal ? imageCredit(samples.author ?? '') : undefined,
    })
    return { dataUrl: `data:${img.mime};base64,${img.data.toString('base64')}` }
  })

export const duplicateTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const row = await getTemplate(data.id)
    if (!row) throw new Error('Template not found')
    const copy = toTemplateData(row)
    return { id: await saveTemplate(null, { ...copy, name: `${copy.name} (copy)` }) }
  })

export const deleteTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const s = await getSettings()
    // Fall back to the built-in design if a default template is deleted.
    if (s.rashifalSignTemplateId === data.id) await saveSettings({ rashifalSignTemplateId: '' })
    if (s.rashifalCoverTemplateId === data.id) await saveSettings({ rashifalCoverTemplateId: '' })
    await deleteTemplate(data.id)
    return { ok: true }
  })

export const setRashifalTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ slot: z.enum(['sign', 'cover']), id: z.string() }))
  .handler(async ({ data }) => {
    if (data.id) {
      const row = await getTemplate(data.id)
      const want = data.slot === 'sign' ? 'rashifal_sign' : 'rashifal_cover'
      if (!row || row.kind !== want) throw new Error('That template is the wrong type for this slot.')
    }
    await saveSettings(
      data.slot === 'sign' ? { rashifalSignTemplateId: data.id } : { rashifalCoverTemplateId: data.id },
    )
    return { ok: true }
  })
