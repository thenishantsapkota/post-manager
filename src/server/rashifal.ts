import { and, desc, eq, gte } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { captionCredit, imageCredit, withCaptionCredit } from '#/lib/credit'
import { describeDate } from '#/lib/nepali-date'
import { SIGNS, getSign } from '#/lib/signs'
import { addDays, nptDateKey } from '#/lib/time'
import { PERIOD_TITLES } from '#/lib/types'
import type { RashifalFormat, RashifalPeriod } from '#/lib/types'
import { getDb, schema } from './db'
import type { RashifalSet } from './db/schema'
import { fetchNepaliPatro } from './nepalipatro'
import { loadBrand } from './render/canvas'
import { getSettings, logActivity } from './settings'
import { saveMedia } from './storage'
import { renderRashifalCoverImage, renderRashifalSign } from './templates'
import type { RashifalRenderContext } from './templates'

const MIN_FETCH_INTERVAL_MS = 10 * 60_000
const g = globalThis as unknown as { __rashifalFetchedAt?: number }

/**
 * Pull the latest sets from Nepali Patro into the database. Sets that were
 * edited by hand keep their edited text. Throttled unless forced.
 */
export async function syncRashifal(force = false) {
  const now = Date.now()
  if (!force && g.__rashifalFetchedAt && now - g.__rashifalFetchedAt < MIN_FETCH_INTERVAL_MS) {
    return { fetched: false, count: 0 }
  }
  const sets = await fetchNepaliPatro()
  g.__rashifalFetchedAt = now
  const db = await getDb()
  for (const set of sets) {
    const existing = await db.query.rashifalSets.findFirst({
      where: and(eq(schema.rashifalSets.period, set.period), eq(schema.rashifalSets.endDate, set.endDate)),
    })
    if (!existing) {
      await db.insert(schema.rashifalSets).values({ id: nanoid(10), ...set, edited: false, fetchedAt: now, updatedAt: now })
    } else {
      await db
        .update(schema.rashifalSets)
        .set({
          title: set.title,
          author: set.author,
          fetchedAt: now,
          ...(existing.edited ? {} : { entries: set.entries, updatedAt: now }),
        })
        .where(eq(schema.rashifalSets.id, existing.id))
    }
  }
  return { fetched: true, count: sets.length }
}

export async function listSets(limit = 40) {
  const db = await getDb()
  return db.select().from(schema.rashifalSets).orderBy(desc(schema.rashifalSets.endDate)).limit(limit)
}

export async function getSet(id: string) {
  const db = await getDb()
  return db.query.rashifalSets.findFirst({ where: eq(schema.rashifalSets.id, id) })
}

/** The set covering `today` for a period, or undefined if not published yet. */
export async function currentSet(period: RashifalPeriod, today = nptDateKey()) {
  const db = await getDb()
  const rows = await db
    .select()
    .from(schema.rashifalSets)
    .where(and(eq(schema.rashifalSets.period, period), gte(schema.rashifalSets.endDate, today)))
    .orderBy(schema.rashifalSets.endDate)
    .limit(1)
  const set = rows[0]
  if (!set) return undefined
  if (period === 'D' && set.endDate !== today) return undefined
  if (period === 'W' && addDays(set.endDate, -6) > today) return undefined
  return set
}

export async function saveSetEdits(id: string, entries: Record<string, string>) {
  const set = await getSet(id)
  if (!set) throw new Error('Rashifal set not found')
  const merged = { ...set.entries }
  for (const sign of SIGNS) {
    const text = entries[sign.key]
    if (typeof text === 'string' && text.trim()) merged[sign.key] = text.trim()
  }
  const db = await getDb()
  await db
    .update(schema.rashifalSets)
    .set({ entries: merged, edited: true, updatedAt: Date.now() })
    .where(eq(schema.rashifalSets.id, id))
}

export function setKey(set: Pick<RashifalSet, 'period' | 'endDate'>) {
  return `${set.period}:${set.endDate}`
}

/** Short period label, e.g. "२०८३ असोज ११, आइतबार" or "असोज ११–१७, २०८३". */
export function setSubtitle(set: Pick<RashifalSet, 'period' | 'endDate' | 'title'>) {
  if (set.period === 'D') {
    const d = describeDate(set.endDate)
    return `${d.bs}, ${d.weekday}`
  }
  if (set.period === 'Y') return `वि.सं. ${describeDate(set.endDate).bs.split(' ')[0]}`
  const stripped = set.title
    .replace(PERIOD_TITLES[set.period], '')
    .replace(/राशिफल/g, '')
    .replace(/^[\s,।:–-]+|[\s,।:–-]+$/g, '')
  return stripped || set.title
}

export function renderContext(set: RashifalSet): RashifalRenderContext {
  return {
    date: set.period === 'D' ? set.endDate : nptDateKey(),
    heading: PERIOD_TITLES[set.period],
    subtitle: setSubtitle(set),
    author: set.author,
    credit: imageCredit(set.author),
  }
}

export function buildRashifalCaption(
  template: string,
  set: RashifalSet,
  opts: { brand: string; hashtags: string },
) {
  const ctx = renderContext(set)
  const d = describeDate(ctx.date)
  const body = SIGNS.map((s) => `${s.symbol} ${s.np}: ${set.entries[s.key]}`).join('\n\n')
  const caption = template
    .replaceAll('{heading}', ctx.heading)
    .replaceAll('{subtitle}', ctx.subtitle)
    .replaceAll('{title}', set.title)
    .replaceAll('{author}', set.author)
    .replaceAll('{date_bs}', d.bs)
    .replaceAll('{date_ad}', d.ad)
    .replaceAll('{weekday}', d.weekday)
    .replaceAll('{rashifal}', body)
    .replaceAll('{brand}', opts.brand)
    .replaceAll('{hashtags}', opts.hashtags)
    .replaceAll('{credit}', captionCredit(set.author))
    .trim()
  // The credit is mandatory and is appended even if the template omits it.
  return withCaptionCredit(caption, set.author)
}

export function coverFooter(format: RashifalFormat) {
  return format === 'album' ? 'तपाईंको राशिफल तलका तस्बिरहरूमा' : 'पूरा राशिफल तल क्याप्सनमा पढ्नुहोस्'
}

export function effectiveFormat(period: RashifalPeriod, format: RashifalFormat): RashifalFormat {
  return period === 'Y' ? 'cover' : format
}

/**
 * Render a set's images and caption.
 * album: cover + 12 sign images · cover: one cover image, full text in caption
 */
export async function buildRashifalPost(set: RashifalSet, requested: RashifalFormat) {
  // Yearly readings (~3,000 characters per sign) don't fit on an image.
  const format = effectiveFormat(set.period, requested)
  const settings = await getSettings()
  const brand = await loadBrand()
  const ctx = renderContext(set)
  const mediaIds: string[] = []
  const label = `${ctx.heading} — ${ctx.subtitle}`

  const footer = coverFooter(format)
  const cover = await renderRashifalCoverImage(ctx, footer, brand)
  mediaIds.push(
    (await saveMedia(cover.data, cover.mime, { kind: 'generated', label: `${label} (cover)`, width: cover.width, height: cover.height })).id,
  )
  if (format === 'album') {
    for (const sign of SIGNS) {
      const img = await renderRashifalSign(ctx, sign.key, set.entries[sign.key], brand)
      const m = await saveMedia(img.data, img.mime, {
        kind: 'generated',
        label: `${label} — ${getSign(sign.key).np}`,
        width: img.width,
        height: img.height,
      })
      mediaIds.push(m.id)
    }
  }

  const caption = buildRashifalCaption(settings.rashifalCaption, set, {
    brand: settings.brandName,
    hashtags: settings.hashtags,
  })
  return { caption, mediaIds, title: label }
}

/** Fetch (throttled) and log problems without throwing; used by the scheduler. */
export async function syncRashifalQuietly() {
  try {
    await syncRashifal()
  } catch (err) {
    await logActivity('error', `Could not fetch rashifal from Nepali Patro: ${(err as Error).message}`)
  }
}
