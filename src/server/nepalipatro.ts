import { z } from 'zod'
import { SIGNS } from '#/lib/signs'
import { RASHIFAL_PERIODS } from '#/lib/types'
import type { RashifalPeriod } from '#/lib/types'
import { config } from './config'

// Client for the Nepali Patro rashifal API (used with permission, see lib/credit.ts).
// One call returns the current daily, weekly, monthly and yearly sets.

const signText = z.string()
const setSchema = z
  .object({
    type: z.enum(RASHIFAL_PERIODS),
    title: z.string().default(''),
    author: z.string().default(''),
    todate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ...Object.fromEntries(SIGNS.map((s) => [s.api, signText])),
  })
  .passthrough()

const responseSchema = z.object({ np: z.array(z.unknown()) })

export interface FetchedSet {
  period: RashifalPeriod
  endDate: string
  title: string
  author: string
  entries: Record<string, string>
}

function clean(text: string) {
  // The API uses "\r\n", occasional non-breaking spaces, and sometimes types
  // ो/ौ as two marks (ा + े / ा + ै), which can render with a dotted circle.
  return text
    .replace(/ाे/g, 'ो')
    .replace(/ाै/g, 'ौ')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function fetchNepaliPatro(): Promise<FetchedSet[]> {
  let res: Response
  try {
    res = await fetch(config.rashifalApiUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'DamakBanda-AutoPoster/1.0' },
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    throw new Error(`Could not reach Nepali Patro: ${(err as Error).message}`)
  }
  if (!res.ok) throw new Error(`Nepali Patro returned HTTP ${res.status}`)

  const parsed = responseSchema.safeParse(await res.json().catch(() => null))
  if (!parsed.success) throw new Error('Nepali Patro returned an unexpected response format')

  const sets: FetchedSet[] = []
  for (const raw of parsed.data.np) {
    const r = setSchema.safeParse(raw)
    if (!r.success) continue // skip unknown/partial periods rather than failing everything
    const data = r.data as Record<string, string>
    const entries: Record<string, string> = {}
    for (const sign of SIGNS) entries[sign.key] = clean(data[sign.api] ?? '')
    if (Object.values(entries).some((t) => !t)) continue
    sets.push({
      period: r.data.type,
      endDate: r.data.todate,
      title: clean(r.data.title),
      author: clean(r.data.author),
      entries,
    })
  }
  if (sets.length === 0) throw new Error('Nepali Patro response contained no complete rashifal')
  return sets
}
