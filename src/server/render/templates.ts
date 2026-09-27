import { createCanvas } from '@napi-rs/canvas'
import type { SKRSContext2D } from '@napi-rs/canvas'
import { SIGNS, getSign } from '#/lib/signs'
import type { ThemeKey } from '#/lib/types'
import {
  H,
  THEMES,
  W,
  drawBackground,
  drawFooter,
  drawHeader,
  ensureFonts,
  fitText,
  font,
  roundRect,
} from './canvas'
import type { Brand } from './canvas'

export interface RenderedImage {
  data: Buffer
  mime: 'image/jpeg'
  width: number
  height: number
}

async function surface(draw: (ctx: SKRSContext2D) => void): Promise<RenderedImage> {
  ensureFonts()
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  draw(ctx)
  const data = await canvas.encode('jpeg', 92)
  return { data, mime: 'image/jpeg', width: W, height: H }
}

export interface SignCardInput {
  sign: string
  text: string
  /** e.g. "आजको राशिफल" */
  heading: string
  /** Footer left text, e.g. the BS date or "असोज ११–१७, २०८३" */
  footer: string
  /** Source credit; always drawn. */
  credit: string
}

/** Small centred credit line just above the footer rule. Mandatory on rashifal images. */
export function drawCredit(ctx: SKRSContext2D, credit: string, y = H - 138) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let size = 24
  ctx.font = font(size, 700)
  while (size > 16 && ctx.measureText(credit).width > W - 144) {
    size -= 1
    ctx.font = font(size, 700)
  }
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.fillText(credit, W / 2, y)
  ctx.restore()
}

export function renderSignCard(input: SignCardInput, brand: Brand) {
  const sign = getSign(input.sign)
  const theme = THEMES[sign.theme]

  return surface((ctx) => {
    drawBackground(ctx, theme)
    drawHeader(ctx, brand, input.heading)

    // Emblem
    const cx = W / 2
    const cy = 300
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.beginPath()
    ctx.arc(cx, cy, 140, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = theme.accent
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(cx, cy, 140, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([4, 14])
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath()
    ctx.arc(cx, cy, 164, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(sign.np.length > 4 ? 88 : 106, 800)
    ctx.fillText(sign.np, cx, cy + 8)

    ctx.font = font(30, 700)
    ctx.fillStyle = theme.accent
    ctx.fillText(`${sign.en.toUpperCase()}  •  ${sign.np} राशि`, cx, 505)
    ctx.font = font(27, 400)
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    ctx.fillText(sign.letters, cx, 548)

    // Text panel
    const px = 72
    const py = 590
    const pw = W - 144
    const ph = 1170 - py
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    roundRect(ctx, px, py, pw, ph, 36)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 2
    ctx.stroke()

    const pad = 48
    const fit = fitText(
      ctx,
      input.text.trim(),
      { width: pw - pad * 2, height: ph - pad * 2 },
      { max: 48, min: 24, weight: 400, lineHeight: 1.55 },
    )
    ctx.font = font(fit.size, 400)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const blockH = fit.lines.length * fit.lineHeight
    let y = py + (ph - blockH) / 2 + fit.size * 0.08
    for (const line of fit.lines) {
      ctx.fillText(line, px + pad, y)
      y += fit.lineHeight
    }

    drawCredit(ctx, input.credit, 1200)
    drawFooter(ctx, brand, input.footer)
  })
}

export interface CoverInput {
  heading: string
  line1: string
  line2: string
  footer: string
  credit: string
}

export function renderRashifalCover(input: CoverInput, brand: Brand, themeKey: ThemeKey = 'crimson') {
  const theme = THEMES[themeKey]

  return surface((ctx) => {
    drawBackground(ctx, theme)
    drawHeader(ctx, brand)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.font = font(input.heading.length > 12 ? 104 : 124, 800)
    ctx.fillText(input.heading, W / 2, 280)
    ctx.fillStyle = theme.accent
    let size = 54
    ctx.font = font(size, 700)
    while (size > 30 && ctx.measureText(input.line1).width > W - 144) ctx.font = font((size -= 2), 700)
    ctx.fillText(input.line1, W / 2, 390)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = font(34, 400)
    ctx.fillText(input.line2, W / 2, 450)

    const gx = 72
    const gy = 510
    const gap = 20
    const cols = 3
    const cw = (W - gx * 2 - gap * (cols - 1)) / cols
    const ch = 142
    SIGNS.forEach((s, i) => {
      const x = gx + (i % cols) * (cw + gap)
      const y = gy + Math.floor(i / cols) * (ch + gap)
      ctx.fillStyle = 'rgba(255,255,255,0.13)'
      roundRect(ctx, x, y, cw, ch, 28)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = font(54, 800)
      ctx.fillText(s.np, x + cw / 2, y + 58)
      ctx.fillStyle = theme.accent
      ctx.font = font(24, 700)
      ctx.fillText(s.en.toUpperCase(), x + cw / 2, y + 108)
    })

    drawCredit(ctx, input.credit, 1190)
    drawFooter(ctx, brand, input.footer)
  })
}

export interface TextCardInput {
  title?: string
  body: string
  theme: ThemeKey
}

export function renderTextCard(card: TextCardInput, brand: Brand) {
  const theme = THEMES[card.theme] ?? THEMES.saffron

  return surface((ctx) => {
    drawBackground(ctx, theme)
    drawHeader(ctx, brand)

    let top = 220
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    if (card.title?.trim()) {
      const t = fitText(ctx, card.title.trim(), { width: W - 180, height: 190 }, { max: 76, min: 44, weight: 800, lineHeight: 1.3 })
      ctx.font = font(t.size, 800)
      ctx.fillStyle = theme.accent
      let y = top
      for (const line of t.lines) {
        ctx.fillText(line, W / 2, y)
        y += t.lineHeight
      }
      top = y + 30
      ctx.fillStyle = theme.accent
      roundRect(ctx, W / 2 - 60, top - 10, 120, 8, 4)
      ctx.fill()
      top += 40
    }

    // Decorative quote mark
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.font = font(260, 800)
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('“', 150, top + 170)

    const bottom = H - 150
    const box = { width: W - 200, height: bottom - top }
    const fit = fitText(ctx, card.body.trim(), box, { max: 84, min: 34, weight: 700, lineHeight: 1.45 })
    ctx.font = font(fit.size, 700)
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'top'
    const blockH = fit.lines.length * fit.lineHeight
    let y = top + (box.height - blockH) / 2
    for (const line of fit.lines) {
      ctx.fillText(line, W / 2, y)
      y += fit.lineHeight
    }

    drawFooter(ctx, brand, brand.name)
  })
}
