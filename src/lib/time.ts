// Nepal has a fixed UTC+05:45 offset and no daylight saving time, so a
// constant offset is exact and works identically on server and browser.
export const NEPAL_TZ = 'Asia/Kathmandu'
const OFFSET_MS = (5 * 60 + 45) * 60 * 1000

/** YYYY-MM-DD for the given instant, as seen in Nepal. */
export function nptDateKey(ms: number = Date.now()): string {
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 10)
}

/** HH:mm for the given instant, as seen in Nepal. */
export function nptTime(ms: number = Date.now()): string {
  return new Date(ms + OFFSET_MS).toISOString().slice(11, 16)
}

/** Convert a Nepal wall-clock date + time into an epoch-ms instant. */
export function nptToEpoch(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return Date.UTC(y, m - 1, d, hh, mm) - OFFSET_MS
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: NEPAL_TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

export function formatNpt(ms: number | null | undefined): string {
  if (!ms) return '—'
  return dateTimeFmt.format(new Date(ms))
}

export function formatRelative(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return '—'
  const diff = ms - now
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60000)
  let text: string
  if (mins < 1) return diff >= 0 ? 'in under a minute' : 'just now'
  if (mins < 60) text = `${mins} min`
  else if (mins < 60 * 24) text = `${Math.round(mins / 60)} hr`
  else text = `${Math.round(mins / 1440)} days`
  return diff >= 0 ? `in ${text}` : `${text} ago`
}
