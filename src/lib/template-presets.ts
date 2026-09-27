import { newLayer } from './template-vars'
import type { ImageLayer, Layer, TemplateData, TemplateKind, TextLayer } from './types'

export const SIZE_PRESETS = [
  { label: 'Portrait 4:5 (1080×1350) — best for feed', w: 1080, h: 1350 },
  { label: 'Square (1080×1080)', w: 1080, h: 1080 },
  { label: 'Story 9:16 (1080×1920)', w: 1080, h: 1920 },
  { label: 'Landscape (1200×630)', w: 1200, h: 630 },
]

export const KIND_LABELS: Record<TemplateKind, string> = {
  general: 'General post',
  rashifal_sign: 'Rashifal — sign image',
  rashifal_cover: 'Rashifal — cover',
  weather: 'Weather',
}

function text(tpl: Pick<TemplateData, 'width' | 'height'>, patch: Partial<TextLayer>): TextLayer {
  return { ...(newLayer('text', tpl) as TextLayer), ...patch }
}

/**
 * Starter layers. With an uploaded base design the text layers are transparent
 * so they don't cover the design; move them onto the design's empty areas.
 */
export function starterLayers(kind: TemplateKind, w: number, h: number, hasBackground = false): Layer[] {
  const t = { width: w, height: h }
  const px = (f: number, of: number) => Math.round(f * of)
  if (kind === 'rashifal_sign') {
    return [
      text(t, { name: 'Sign name', text: '{sign_np}', x: px(0.1, w), y: px(0.08, h), w: px(0.8, w), h: px(0.14, h), fontSize: px(0.11, w), minFontSize: px(0.06, w), weight: 800, shadow: true }),
      text(t, { name: 'Heading', text: '{heading} · {subtitle}', x: px(0.1, w), y: px(0.23, h), w: px(0.8, w), h: px(0.06, h), fontSize: px(0.035, w), minFontSize: px(0.025, w), weight: 700 }),
      text(t, { name: 'Rashifal', text: '{rashifal}', x: px(0.08, w), y: px(0.32, h), w: px(0.84, w), h: px(0.52, h), fontSize: px(0.045, w), minFontSize: px(0.022, w), weight: 400, align: 'left', bgColor: hasBackground ? '' : 'rgba(0,0,0,0.35)', padding: px(0.04, w), bgRadius: px(0.03, w), shadow: hasBackground }),
      text(t, { name: 'Credit', text: '{credit}', x: px(0.05, w), y: px(0.88, h), w: px(0.9, w), h: px(0.04, h), fontSize: px(0.022, w), minFontSize: px(0.015, w), weight: 700 }),
    ]
  }
  if (kind === 'rashifal_cover') {
    return [
      text(t, { name: 'Heading', text: '{heading}', x: px(0.08, w), y: px(0.3, h), w: px(0.84, w), h: px(0.16, h), fontSize: px(0.12, w), minFontSize: px(0.06, w), weight: 800, shadow: true }),
      text(t, { name: 'Subtitle', text: '{subtitle}', x: px(0.08, w), y: px(0.47, h), w: px(0.84, w), h: px(0.08, h), fontSize: px(0.055, w), minFontSize: px(0.03, w), weight: 700 }),
      text(t, { name: 'Credit', text: '{credit}', x: px(0.05, w), y: px(0.88, h), w: px(0.9, w), h: px(0.04, h), fontSize: px(0.022, w), minFontSize: px(0.015, w), weight: 700 }),
    ]
  }
  if (kind === 'weather') {
    const icon: ImageLayer = {
      ...(newLayer('image', t) as ImageLayer),
      name: 'Weather icon',
      source: 'weather_icon',
      fit: 'contain',
      x: px(0.08, w),
      y: px(0.15, h),
      w: px(0.3, w),
      h: px(0.3, w),
      radius: 0,
    }
    return [
      text(t, { name: 'Title', text: '{slot_title} · {place}', x: px(0.08, w), y: px(0.05, h), w: px(0.84, w), h: px(0.07, h), fontSize: px(0.045, w), minFontSize: px(0.03, w), weight: 800, shadow: true }),
      icon,
      text(t, { name: 'Temperature', text: '{temp}', x: px(0.45, w), y: px(0.15, h), w: px(0.47, w), h: px(0.16, h), fontSize: px(0.16, w), minFontSize: px(0.08, w), weight: 800, shadow: true }),
      text(t, { name: 'Condition', text: '{condition}', x: px(0.45, w), y: px(0.31, h), w: px(0.47, w), h: px(0.06, h), fontSize: px(0.045, w), minFontSize: px(0.03, w), weight: 700 }),
      text(t, { name: 'Summary', text: '{summary}', x: px(0.08, w), y: px(0.45, h), w: px(0.84, w), h: px(0.2, h), fontSize: px(0.04, w), minFontSize: px(0.022, w), weight: 400, align: 'left', bgColor: hasBackground ? '' : 'rgba(0,0,0,0.3)', padding: px(0.03, w), bgRadius: px(0.03, w), shadow: hasBackground }),
      text(t, { name: 'Details', text: 'अधिकतम {high} · न्यूनतम {low}\nवर्षा {rain_chance} · आर्द्रता {humidity}', x: px(0.08, w), y: px(0.68, h), w: px(0.84, w), h: px(0.14, h), fontSize: px(0.04, w), minFontSize: px(0.025, w), weight: 700 }),
      text(t, { name: 'Credit', text: '{credit}', x: px(0.05, w), y: px(0.9, h), w: px(0.9, w), h: px(0.04, h), fontSize: px(0.022, w), minFontSize: px(0.015, w), weight: 700 }),
    ]
  }
  return [
    text(t, { name: 'Title', text: '{title}', x: px(0.08, w), y: px(0.12, h), w: px(0.84, w), h: px(0.14, h), fontSize: px(0.075, w), minFontSize: px(0.04, w), weight: 800, shadow: true }),
    text(t, { name: 'Message', text: '{message}', x: px(0.1, w), y: px(0.32, h), w: px(0.8, w), h: px(0.45, h), fontSize: px(0.06, w), minFontSize: px(0.03, w), weight: 700 }),
  ]
}
