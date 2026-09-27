export const THEME_KEYS = [
  'saffron',
  'crimson',
  'night',
  'royal',
  'forest',
  'ocean',
] as const
export type ThemeKey = (typeof THEME_KEYS)[number]

// ---------------------------------------------------------------------------
// Templates: an uploaded background design plus positioned layers.
// Coordinates are in template pixels (the template's own width/height).
// ---------------------------------------------------------------------------

export type TemplateKind = 'general' | 'rashifal_sign' | 'rashifal_cover' | 'weather'

interface BaseLayer {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  /** Degrees, clockwise around the layer centre. */
  rotation: number
  /** 0–1 */
  opacity: number
  hidden?: boolean
}

export interface TextLayer extends BaseLayer {
  type: 'text'
  /** May contain {variables}, e.g. "{sign_np} राशि". */
  text: string
  fontSize: number
  /** Smallest size auto-fit may shrink to. Equal to fontSize disables shrinking. */
  minFontSize: number
  weight: 400 | 700 | 800
  color: string
  align: 'left' | 'center' | 'right'
  vAlign: 'top' | 'middle' | 'bottom'
  lineHeight: number
  shadow: boolean
  strokeColor: string
  strokeWidth: number
  /** Optional box behind the text; empty string for none. */
  bgColor: string
  bgRadius: number
  padding: number
}

export interface ImageLayer extends BaseLayer {
  type: 'image'
  /** logo: brand logo from settings · slot: filled per post · media: fixed image · weather_icon: current weather icon */
  source: 'logo' | 'slot' | 'media' | 'weather_icon'
  /** Field name when source is "slot", e.g. "photo". */
  slot: string
  mediaId: string
  fit: 'cover' | 'contain'
  radius: number
  circle: boolean
  borderColor: string
  borderWidth: number
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape'
  fill: string
  radius: number
  strokeColor: string
  strokeWidth: number
}

export type Layer = TextLayer | ImageLayer | ShapeLayer

export interface TemplateData {
  name: string
  kind: TemplateKind
  width: number
  height: number
  backgroundMediaId: string | null
  backgroundColor: string
  /** rashifal_sign only: a different background per zodiac sign. */
  signBackgrounds: Record<string, string>
  layers: Layer[]
}

/** Values used to fill a template. */
export interface TemplateInput {
  vars: Record<string, string>
  /** slot name → media id */
  slots: Record<string, string>
  /** For rashifal_sign templates: picks the per-sign background. */
  signKey?: string
  /** For weather templates: the icon drawn by weather_icon layers. */
  weather?: { icon: string; isDay: boolean }
}

/**
 * A generated image recipe stored on library items and used by the composer.
 * templateId null means the built-in text card (uses vars.title / vars.body).
 */
export interface CardSpec {
  templateId: string | null
  theme: ThemeKey
  vars: Record<string, string>
  slots: Record<string, string>
}

// ---------------------------------------------------------------------------
// Image editing (non-destructive: always produces a new media item).
// ---------------------------------------------------------------------------

export interface ImageEdits {
  rotate: 0 | 90 | 180 | 270
  flipH: boolean
  flipV: boolean
  /** Fractions (0–1) of the rotated image. Omit for no crop. */
  crop?: { x: number; y: number; w: number; h: number }
  /** Percent, 100 = unchanged */
  brightness: number
  contrast: number
  saturation: number
  /** Pixels */
  blur: number
  grayscale: boolean
  sepia: boolean
  /** Longest side after resize; 0 keeps the size. */
  maxSize: number
  watermark?: {
    position: 'tl' | 'tr' | 'bl' | 'br' | 'center'
    /** Fraction of the output width */
    size: number
    opacity: number
  }
}

export const DEFAULT_EDITS: ImageEdits = {
  rotate: 0,
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  grayscale: false,
  sepia: false,
  maxSize: 2048,
}

export type RashifalFormat = 'album' | 'cover'

/** Nepali Patro periods: daily, weekly, monthly, yearly. */
export const RASHIFAL_PERIODS = ['D', 'W', 'M', 'Y'] as const
export type RashifalPeriod = (typeof RASHIFAL_PERIODS)[number]

export const PERIOD_TITLES: Record<RashifalPeriod, string> = {
  D: 'आजको राशिफल',
  W: 'साप्ताहिक राशिफल',
  M: 'मासिक राशिफल',
  Y: 'वार्षिक राशिफल',
}

export const PERIOD_LABELS: Record<RashifalPeriod, string> = {
  D: 'Daily',
  W: 'Weekly',
  M: 'Monthly',
  Y: 'Yearly',
}

export interface RashifalAutomationConfig {
  kind: 'rashifal'
  period: RashifalPeriod
  /** album: cover + 12 sign images · cover: one image, full text in the caption */
  format: RashifalFormat
}

export interface LibraryAutomationConfig {
  kind: 'library'
  collection: string
  order: 'sequential' | 'random'
}

export interface WeatherAutomationConfig {
  kind: 'weather'
  slot: 'morning' | 'afternoon' | 'evening'
}

export type AutomationConfig =
  | RashifalAutomationConfig
  | LibraryAutomationConfig
  | WeatherAutomationConfig

export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
