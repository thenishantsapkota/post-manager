import { nanoid } from 'nanoid'
import type { ImageLayer, Layer, ShapeLayer, TemplateData, TemplateKind, TextLayer } from './types'

export interface VarInfo {
  key: string
  label: string
  sample: string
}

/** Filled automatically on every template. */
export const AUTO_VARS: VarInfo[] = [
  { key: 'date_bs', label: 'Nepali date (BS)', sample: '२०८३ असोज ११' },
  { key: 'weekday', label: 'Weekday (Nepali)', sample: 'आइतबार' },
  { key: 'date_ad', label: 'English date', sample: '27 September 2026' },
  { key: 'brand', label: 'Page name', sample: 'Damak Banda' },
  { key: 'handle', label: 'Page handle', sample: 'facebook.com/damakbanda' },
]

const RASHIFAL_COMMON: VarInfo[] = [
  { key: 'heading', label: 'Heading (आजको/साप्ताहिक… राशिफल)', sample: 'आजको राशिफल' },
  { key: 'subtitle', label: 'Period (date or range)', sample: '२०८३ असोज ११, आइतबार' },
  { key: 'author', label: 'Astrologer', sample: 'उपप्रा. लक्ष्मीप्रसाद बराल (फलितज्योतिषाचार्य)' },
  {
    key: 'credit',
    label: 'Source credit (required — added automatically if you leave it out)',
    sample: 'स्रोत: नेपाली पात्रो (nepalipatro.com.np) · उपप्रा. लक्ष्मीप्रसाद बराल (फलितज्योतिषाचार्य)',
  },
]

/** Filled automatically on rashifal sign templates. */
export const RASHIFAL_VARS: VarInfo[] = [
  ...RASHIFAL_COMMON,
  { key: 'sign_np', label: 'Sign name (Nepali)', sample: 'वृश्चिक' },
  { key: 'sign_en', label: 'Sign name (English)', sample: 'Scorpio' },
  { key: 'sign_letters', label: 'Name letters', sample: 'तो, ना, नि, नु, ने, नो, या, यि, यु' },
  {
    key: 'rashifal',
    label: 'Rashifal text',
    sample:
      'परिस्थितिले खर्च बढाउनेछ। आशा देखाउनेहरूको भरपर्दा धोका पाइएला। परिश्रमका तुलनामा प्रतिफल कम देखिनेछ। व्यवसायमा लगानी बढाउनुपरे पनि उधारोमा व्यापार हुनेछ।',
  },
]

export const RASHIFAL_COVER_VARS: VarInfo[] = RASHIFAL_COMMON

export function builtinVars(kind: TemplateKind): VarInfo[] {
  if (kind === 'rashifal_sign') return [...AUTO_VARS, ...RASHIFAL_VARS]
  if (kind === 'rashifal_cover') return [...AUTO_VARS, ...RASHIFAL_COVER_VARS]
  return AUTO_VARS
}

const TOKEN = /\{([a-zA-Z0-9_]+)\}/g

export function fillVars(text: string, vars: Record<string, string>): string {
  return text.replace(TOKEN, (_, key: string) => vars[key] ?? '')
}

/** Variables and image slots a user must supply when using this template. */
export function templateFields(tpl: Pick<TemplateData, 'kind' | 'layers'>) {
  const builtin = new Set(builtinVars(tpl.kind).map((v) => v.key))
  const vars = new Set<string>()
  const slots = new Set<string>()
  for (const layer of tpl.layers) {
    if (layer.type === 'text') {
      for (const m of layer.text.matchAll(TOKEN)) if (!builtin.has(m[1])) vars.add(m[1])
    } else if (layer.type === 'image' && layer.source === 'slot' && layer.slot) {
      slots.add(layer.slot)
    }
  }
  return { vars: [...vars], slots: [...slots] }
}

export function sampleVars(kind: TemplateKind): Record<string, string> {
  return Object.fromEntries(builtinVars(kind).map((v) => [v.key, v.sample]))
}

export function newLayer(type: Layer['type'], tpl: Pick<TemplateData, 'width' | 'height'>): Layer {
  const base = {
    id: nanoid(8),
    x: Math.round(tpl.width * 0.1),
    y: Math.round(tpl.height * 0.4),
    w: Math.round(tpl.width * 0.8),
    h: Math.round(tpl.height * 0.15),
    rotation: 0,
    opacity: 1,
  }
  if (type === 'text') {
    const layer: TextLayer = {
      ...base,
      type: 'text',
      name: 'Text',
      text: '{title}',
      fontSize: Math.round(tpl.width / 16),
      minFontSize: Math.round(tpl.width / 40),
      weight: 700,
      color: '#ffffff',
      align: 'center',
      vAlign: 'middle',
      lineHeight: 1.45,
      shadow: false,
      strokeColor: '#000000',
      strokeWidth: 0,
      bgColor: '',
      bgRadius: 24,
      padding: 0,
    }
    return layer
  }
  if (type === 'image') {
    const size = Math.round(tpl.width * 0.3)
    const layer: ImageLayer = {
      ...base,
      w: size,
      h: size,
      x: Math.round((tpl.width - size) / 2),
      type: 'image',
      name: 'Photo',
      source: 'slot',
      slot: 'photo',
      mediaId: '',
      fit: 'cover',
      radius: 24,
      circle: false,
      borderColor: '#ffffff',
      borderWidth: 0,
    }
    return layer
  }
  const layer: ShapeLayer = {
    ...base,
    type: 'shape',
    name: 'Box',
    fill: 'rgba(0,0,0,0.35)',
    radius: 32,
    strokeColor: '#ffffff',
    strokeWidth: 0,
  }
  return layer
}
