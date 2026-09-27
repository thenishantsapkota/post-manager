import { desc, lt } from 'drizzle-orm'
import { getDb, schema } from './db'

export interface Settings {
  fbPageId: string
  fbPageToken: string
  fbPageName: string
  brandName: string
  brandHandle: string
  logoMediaId: string
  hashtags: string
  rashifalCaption: string
  /** Custom template ids; empty uses the built-in design. */
  rashifalSignTemplateId: string
  rashifalCoverTemplateId: string
  weatherPlaceNp: string
  weatherPlaceEn: string
  weatherLat: string
  weatherLon: string
  weatherCaption: string
  weatherHashtags: string
  weatherTemplateId: string
}

// The Nepali Patro credit is appended automatically to every rashifal caption.
export const DEFAULT_RASHIFAL_CAPTION = `🌞 {heading} — {subtitle}

{rashifal}

{hashtags}`

// The Open-Meteo credit is appended automatically to every weather caption.
export const DEFAULT_WEATHER_CAPTION = `{slot_emoji} {slot_title} — {place}, {date_bs}

{summary}

{details}

{hashtags}`

const DEFAULTS: Settings = {
  fbPageId: '',
  fbPageToken: '',
  fbPageName: '',
  brandName: 'Damak Banda',
  brandHandle: 'facebook.com/damakbanda',
  logoMediaId: '',
  hashtags: '#DamakBanda #Rashifal #राशिफल #Nepal',
  rashifalCaption: DEFAULT_RASHIFAL_CAPTION,
  rashifalSignTemplateId: '',
  rashifalCoverTemplateId: '',
  weatherPlaceNp: 'दमक',
  weatherPlaceEn: 'Damak',
  weatherLat: '26.6641',
  weatherLon: '87.6989',
  weatherCaption: DEFAULT_WEATHER_CAPTION,
  weatherHashtags: '#DamakBanda #Damak #मौसम #Weather #Jhapa',
  weatherTemplateId: '',
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb()
  const rows = await db.select().from(schema.settings)
  const out = { ...DEFAULTS }
  for (const row of rows) {
    if (row.key in out) (out as Record<string, string>)[row.key] = row.value
  }
  return out
}

export async function saveSettings(patch: Partial<Settings>) {
  const db = await getDb()
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULTS) || value === undefined) continue
    await db
      .insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value } })
  }
}

/** Page credentials, or a clear error telling the user where to set them. */
export async function getPageCredentials() {
  const s = await getSettings()
  if (!s.fbPageId || !s.fbPageToken) {
    throw new Error('Facebook page is not connected. Open Settings to connect it.')
  }
  return { pageId: s.fbPageId, token: s.fbPageToken }
}

export async function logActivity(
  level: 'info' | 'success' | 'error',
  message: string,
) {
  const db = await getDb()
  const now = Date.now()
  await db.insert(schema.activityLog).values({ level, message, createdAt: now })
  // Keep 30 days of history.
  await db
    .delete(schema.activityLog)
    .where(lt(schema.activityLog.createdAt, now - 30 * 86400_000))
  const tag = level === 'error' ? 'ERROR' : level.toUpperCase()
  console.log(`[damak-banda] ${tag}: ${message}`)
}

export async function recentActivity(limit = 15) {
  const db = await getDb()
  return db
    .select()
    .from(schema.activityLog)
    .orderBy(desc(schema.activityLog.id))
    .limit(limit)
}
