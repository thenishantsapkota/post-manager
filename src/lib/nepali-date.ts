import NepaliDateModule from 'nepali-date-converter'

// The package is UMD; depending on the bundler the class is the default export
// or nested under `.default`.
const NepaliDate: typeof NepaliDateModule =
  (NepaliDateModule as unknown as { default?: typeof NepaliDateModule }).default ?? NepaliDateModule

const MONTHS = [
  'बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज',
  'कात्तिक', 'मंसिर', 'पुस', 'माघ', 'फागुन', 'चैत',
]
const WEEKDAYS = ['आइतबार', 'सोमबार', 'मङ्गलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार']
const DIGITS = '०१२३४५६७८९'
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function toNepaliDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => DIGITS[Number(d)])
}

export interface NepaliDateInfo {
  /** e.g. "२०८३ असोज ११" */
  bs: string
  /** e.g. "आइतबार" */
  weekday: string
  /** e.g. "27 September 2026" */
  ad: string
}

/** Describe a Nepal calendar date (YYYY-MM-DD, AD) in Bikram Sambat. */
export function describeDate(dateKey: string): NepaliDateInfo {
  const [y, m, d] = dateKey.split('-').map(Number)
  // Local-time constructor: the converter reads local Y/M/D components.
  const local = new Date(y, m - 1, d)
  const nd = new NepaliDate(local)
  const bs = `${toNepaliDigits(nd.getYear())} ${MONTHS[nd.getMonth()]} ${toNepaliDigits(nd.getDate())}`
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return { bs, weekday, ad: `${d} ${EN_MONTHS[m - 1]} ${y}` }
}
