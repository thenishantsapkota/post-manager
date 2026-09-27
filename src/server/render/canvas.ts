import path from 'node:path'
import { GlobalFonts, loadImage } from '@napi-rs/canvas'
import type { Image, SKRSContext2D } from '@napi-rs/canvas'
import type { ThemeKey } from '#/lib/types'
import { getMedia, readMediaFile } from '../storage'
import { getSettings } from '../settings'

export const W = 1080
export const H = 1350 // 4:5 portrait — the largest ratio Facebook shows uncropped in feed.
export const FONT = 'Mukta'

let fontsLoaded = false
export function ensureFonts() {
  if (fontsLoaded) return
  const dir = path.resolve(process.env.FONTS_DIR ?? './assets/fonts')
  for (const file of ['Mukta-Regular.ttf', 'Mukta-Bold.ttf', 'Mukta-ExtraBold.ttf']) {
    if (!GlobalFonts.registerFromPath(path.join(dir, file), FONT)) {
      throw new Error(`Could not load font ${file} from ${dir}`)
    }
  }
  fontsLoaded = true
}

export interface Theme {
  stops: [string, string, string]
  accent: string
}

export const THEMES: Record<ThemeKey, Theme> = {
  saffron: { stops: ['#7c2d12', '#c2410c', '#f59e0b'], accent: '#fde68a' },
  crimson: { stops: ['#450a0a', '#9f1239', '#e11d48'], accent: '#fecdd3' },
  night: { stops: ['#020617', '#1e1b4b', '#4338ca'], accent: '#c7d2fe' },
  royal: { stops: ['#2e1065', '#6b21a8', '#c026d3'], accent: '#f5d0fe' },
  forest: { stops: ['#052e16', '#15803d', '#65a30d'], accent: '#d9f99d' },
  ocean: { stops: ['#082f49', '#0369a1', '#0891b2'], accent: '#a5f3fc' },
}

export interface Brand {
  name: string
  handle: string
  logo?: Image
}

export async function loadBrand(): Promise<Brand> {
  const s = await getSettings()
  let logo: Image | undefined
  if (s.logoMediaId) {
    const row = await getMedia(s.logoMediaId)
    if (row) logo = await loadImage(await readMediaFile(row))
  }
  return { name: s.brandName, handle: s.brandHandle, logo }
}

export function font(size: number, weight: 400 | 700 | 800 = 400) {
  return `${weight === 400 ? '' : weight === 700 ? 'bold ' : '800 '}${size}px ${FONT}`
}

export function drawBackground(ctx: SKRSContext2D, theme: Theme) {
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, theme.stops[0])
  g.addColorStop(0.55, theme.stops[1])
  g.addColorStop(1, theme.stops[2])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Soft glow behind the upper content.
  const glow = ctx.createRadialGradient(W / 2, 330, 40, W / 2, 330, 620)
  glow.addColorStop(0, 'rgba(255,255,255,0.18)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Mandala-style rings in two corners.
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  for (const [cx, cy] of [[W + 40, -40], [-60, H + 60]]) {
    for (let r = 120; r <= 520; r += 56) {
      ctx.lineWidth = r % 112 === 8 ? 3 : 1.5
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  // Petal ring around the top-right corner.
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(W + 40 + Math.cos(a) * 300, -40 + Math.sin(a) * 300, 18, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function roundRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Greedy word wrap. Respects explicit newlines. */
export function wrap(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of text.replace(/\r/g, '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = words[0]
    for (const word of words.slice(1)) {
      const candidate = `${line} ${word}`
      if (ctx.measureText(candidate).width <= maxWidth) line = candidate
      else {
        lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines
}

/** Largest font size (stepping down) at which text fits the box. */
export function fitText(
  ctx: SKRSContext2D,
  text: string,
  box: { width: number; height: number },
  opts: { max: number; min: number; weight?: 400 | 700 | 800; lineHeight?: number },
) {
  const lh = opts.lineHeight ?? 1.5
  for (let size = opts.max; size >= opts.min; size -= 2) {
    ctx.font = font(size, opts.weight)
    const lines = wrap(ctx, text, box.width)
    if (lines.length * size * lh <= box.height) return { size, lines, lineHeight: size * lh }
  }
  ctx.font = font(opts.min, opts.weight)
  const lines = wrap(ctx, text, box.width)
  const maxLines = Math.max(1, Math.floor(box.height / (opts.min * lh)))
  const clipped = lines.slice(0, maxLines)
  if (lines.length > maxLines) clipped[maxLines - 1] = `${clipped[maxLines - 1]} …`
  return { size: opts.min, lines: clipped, lineHeight: opts.min * lh }
}

export function drawHeader(ctx: SKRSContext2D, brand: Brand, rightText?: string) {
  const y = 96
  let x = 72
  if (brand.logo) {
    const r = 34
    ctx.save()
    ctx.beginPath()
    ctx.arc(x + r, y, r, 0, Math.PI * 2)
    ctx.clip()
    const img = brand.logo
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, x + r - dw / 2, y - dh / 2, dw, dh)
    ctx.restore()
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x + r, y, r, 0, Math.PI * 2)
    ctx.stroke()
    x += r * 2 + 20
  }
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = font(38, 800)
  ctx.fillText(brand.name, x, y + 2)
  if (rightText) {
    ctx.textAlign = 'right'
    ctx.font = font(30, 700)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillText(rightText, W - 72, y + 2)
  }
  ctx.textAlign = 'left'
}

export function drawFooter(ctx: SKRSContext2D, brand: Brand, leftText: string) {
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(72, H - 110)
  ctx.lineTo(W - 72, H - 110)
  ctx.stroke()
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = font(30, 700)
  ctx.textAlign = 'left'
  ctx.fillText(leftText, 72, H - 60)
  ctx.textAlign = 'right'
  ctx.font = font(28, 400)
  ctx.fillText(brand.handle, W - 72, H - 60)
  ctx.textAlign = 'left'
}

export function drawPill(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  opts: { size: number; fill: string; color: string; align?: 'left' | 'center' },
) {
  ctx.font = font(opts.size, 700)
  const w = ctx.measureText(text).width + opts.size * 1.4
  const h = opts.size * 1.9
  const left = opts.align === 'center' ? x - w / 2 : x
  ctx.fillStyle = opts.fill
  roundRect(ctx, left, y, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = opts.color
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(text, left + w / 2, y + h / 2 + 2)
  ctx.textAlign = 'left'
  return w
}
