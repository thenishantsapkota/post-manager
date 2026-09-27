import { desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { describeDate } from '#/lib/nepali-date'
import { getSign } from '#/lib/signs'
import type { CardSpec, TemplateData } from '#/lib/types'
import { nptDateKey } from '#/lib/time'
import { getDb, schema } from './db'
import type { Template } from './db/schema'
import { getSettings } from './settings'
import { saveMedia } from './storage'
import { loadBrand } from './render/canvas'
import type { Brand } from './render/canvas'
import { renderTemplate } from './render/engine'
import { renderRashifalCover, renderSignCard, renderTextCard } from './render/templates'
import type { RenderedImage } from './render/templates'

export function toTemplateData(row: Template): TemplateData {
  return {
    name: row.name,
    kind: row.kind,
    width: row.width,
    height: row.height,
    backgroundMediaId: row.backgroundMediaId,
    backgroundColor: row.backgroundColor,
    signBackgrounds: row.signBackgrounds,
    layers: row.layers,
  }
}

export async function listTemplates() {
  const db = await getDb()
  return db.select().from(schema.templates).orderBy(desc(schema.templates.updatedAt))
}

export async function getTemplate(id: string) {
  const db = await getDb()
  return db.query.templates.findFirst({ where: eq(schema.templates.id, id) })
}

export async function saveTemplate(id: string | null, data: TemplateData) {
  const db = await getDb()
  const now = Date.now()
  if (id) {
    await db
      .update(schema.templates)
      .set({ ...data, updatedAt: now })
      .where(eq(schema.templates.id, id))
    return id
  }
  const newId = nanoid(10)
  await db.insert(schema.templates).values({ ...data, id: newId, createdAt: now, updatedAt: now })
  return newId
}

export async function deleteTemplate(id: string) {
  const db = await getDb()
  await db.delete(schema.templates).where(eq(schema.templates.id, id))
}

/** Variables every template gets for free. */
export function baseVars(date: string, brand: Brand): Record<string, string> {
  const d = describeDate(date)
  return {
    date_bs: d.bs,
    weekday: d.weekday,
    date_ad: d.ad,
    brand: brand.name,
    handle: brand.handle,
  }
}

/** Render a card recipe (custom template or the built-in text card). */
export async function renderCard(spec: CardSpec, date = nptDateKey()): Promise<RenderedImage> {
  const brand = await loadBrand()
  if (spec.templateId) {
    const row = await getTemplate(spec.templateId)
    if (!row) throw new Error('The selected template no longer exists.')
    return renderTemplate(
      toTemplateData(row),
      { vars: { ...baseVars(date, brand), ...spec.vars }, slots: spec.slots },
      brand,
    )
  }
  return renderTextCard(
    { title: spec.vars.title, body: spec.vars.body ?? '', theme: spec.theme },
    brand,
  )
}

export async function renderCardToMedia(spec: CardSpec, label: string) {
  const img = await renderCard(spec)
  return saveMedia(img.data, img.mime, { kind: 'generated', label, width: img.width, height: img.height })
}

async function customTemplate(id: string) {
  if (!id) return null
  const row = await getTemplate(id)
  return row ? toTemplateData(row) : null
}

/** Everything needed to render one rashifal set, already resolved to display text. */
export interface RashifalRenderContext {
  date: string
  heading: string
  subtitle: string
  author: string
  credit: string
}

function rashifalCommonVars(ctx: RashifalRenderContext) {
  return { heading: ctx.heading, subtitle: ctx.subtitle, author: ctx.author, credit: ctx.credit }
}

export async function renderRashifalSign(
  ctx: RashifalRenderContext,
  signKey: string,
  text: string,
  brand?: Brand,
) {
  brand ??= await loadBrand()
  const s = await getSettings()
  const tpl = await customTemplate(s.rashifalSignTemplateId)
  if (tpl) {
    const sign = getSign(signKey)
    const vars = {
      ...baseVars(ctx.date, brand),
      ...rashifalCommonVars(ctx),
      sign_np: sign.np,
      sign_en: sign.en,
      sign_letters: sign.letters,
      rashifal: text,
    }
    return renderTemplate(tpl, { vars, slots: {}, signKey }, brand, { credit: ctx.credit })
  }
  return renderSignCard(
    { sign: signKey, text, heading: ctx.heading, footer: ctx.subtitle, credit: ctx.credit },
    brand,
  )
}

export async function renderRashifalCoverImage(ctx: RashifalRenderContext, footer: string, brand?: Brand) {
  brand ??= await loadBrand()
  const s = await getSettings()
  const tpl = await customTemplate(s.rashifalCoverTemplateId)
  if (tpl) {
    const vars = { ...baseVars(ctx.date, brand), ...rashifalCommonVars(ctx), footer }
    return renderTemplate(tpl, { vars, slots: {} }, brand, { credit: ctx.credit })
  }
  const d = describeDate(ctx.date)
  return renderRashifalCover(
    { heading: ctx.heading, line1: ctx.subtitle, line2: d.ad, footer, credit: ctx.credit },
    brand,
  )
}
