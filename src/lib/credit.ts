// Rashifal content is provided by Nepali Patro, used with their permission.
// Every image and caption built from it MUST carry this credit. The helpers
// below are applied in code (not via editable templates) so it can't be lost.

export const SOURCE_NAME_NP = 'नेपाली पात्रो'
export const SOURCE_NAME_EN = 'Nepali Patro'
export const SOURCE_URL = 'nepalipatro.com.np'

/** Short credit drawn on every rashifal image. */
export function imageCredit(author: string): string {
  const who = author.trim()
  return who
    ? `स्रोत: ${SOURCE_NAME_NP} (${SOURCE_URL}) · ${who}`
    : `स्रोत: ${SOURCE_NAME_NP} (${SOURCE_URL})`
}

/** Credit block appended to every rashifal caption. */
export function captionCredit(author: string): string {
  const lines = [`📖 राशिफल स्रोत: ${SOURCE_NAME_NP} (${SOURCE_NAME_EN}) — https://${SOURCE_URL}`]
  if (author.trim()) lines.push(`✍️ ज्योतिष: ${author.trim()}`)
  lines.push(`Rashifal courtesy of ${SOURCE_NAME_EN}. All rights to the content belong to ${SOURCE_NAME_EN}.`)
  return lines.join('\n')
}

/** Ensures the caption ends with the credit, even if a template left it out. */
export function withCaptionCredit(caption: string, author: string): string {
  const credit = captionCredit(author)
  return caption.includes(credit) ? caption : `${caption.trimEnd()}\n\n${credit}`
}
