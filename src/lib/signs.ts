import type { ThemeKey } from './types'

export interface ZodiacSign {
  key: string
  np: string
  en: string
  /** Field name in the Nepali Patro API response. */
  api: string
  symbol: string
  /** Traditional starting syllables (नामाक्षर) for the rashi. */
  letters: string
  theme: ThemeKey
}

export const SIGNS: ZodiacSign[] = [
  { key: 'mesh', np: 'मेष', en: 'Aries', api: 'aries', symbol: '♈', letters: 'चु, चे, चो, ला, लि, लु, ले, लो, अ', theme: 'saffron' },
  { key: 'brish', np: 'वृष', en: 'Taurus', api: 'taurus', symbol: '♉', letters: 'इ, उ, ए, ओ, वा, वि, वु, वे, वो', theme: 'forest' },
  { key: 'mithun', np: 'मिथुन', en: 'Gemini', api: 'gemini', symbol: '♊', letters: 'का, कि, कु, घ, ङ, छ, के, को, हा', theme: 'ocean' },
  { key: 'karkat', np: 'कर्कट', en: 'Cancer', api: 'cancer', symbol: '♋', letters: 'हि, हु, हे, हो, डा, डि, डु, डे, डो', theme: 'night' },
  { key: 'simha', np: 'सिंह', en: 'Leo', api: 'leo', symbol: '♌', letters: 'मा, मि, मु, मे, मो, टा, टि, टु, टे', theme: 'crimson' },
  { key: 'kanya', np: 'कन्या', en: 'Virgo', api: 'virgo', symbol: '♍', letters: 'टो, पा, पि, पु, ष, ण, ठ, पे, पो', theme: 'forest' },
  { key: 'tula', np: 'तुला', en: 'Libra', api: 'libra', symbol: '♎', letters: 'रा, रि, रु, रे, रो, ता, ति, तु, ते', theme: 'royal' },
  { key: 'brishchik', np: 'वृश्चिक', en: 'Scorpio', api: 'scorpio', symbol: '♏', letters: 'तो, ना, नि, नु, ने, नो, या, यि, यु', theme: 'night' },
  { key: 'dhanu', np: 'धनु', en: 'Sagittarius', api: 'sagittarius', symbol: '♐', letters: 'ये, यो, भा, भि, भु, धा, फा, ढा, भे', theme: 'saffron' },
  { key: 'makar', np: 'मकर', en: 'Capricorn', api: 'capricorn', symbol: '♑', letters: 'भो, जा, जि, जु, जे, जो, खि, खु, खे, खो, गा, गि', theme: 'forest' },
  { key: 'kumbha', np: 'कुम्भ', en: 'Aquarius', api: 'aquarius', symbol: '♒', letters: 'गु, गे, गो, सा, सि, सु, से, सो, दा', theme: 'ocean' },
  { key: 'meen', np: 'मीन', en: 'Pisces', api: 'pisces', symbol: '♓', letters: 'दि, दु, थ, झ, ञ, दे, दो, चा, चि', theme: 'royal' },
]

export const SIGN_KEYS = SIGNS.map((s) => s.key) as [string, ...string[]]

export function getSign(key: string): ZodiacSign {
  const sign = SIGNS.find((s) => s.key === key)
  if (!sign) throw new Error(`Unknown zodiac sign: ${key}`)
  return sign
}
