import { createCanvas, loadImage } from '@napi-rs/canvas'
import type { Image, SKRSContext2D } from '@napi-rs/canvas'
import { fillVars } from '#/lib/template-vars'
import type { ImageLayer, Layer, ShapeLayer, TemplateData, TemplateInput, TextLayer } from '#/lib/types'
import { getMedia, readMediaFile } from '../storage'
import { ensureFonts, fitText, font, roundRect, wrap } from './canvas'
import type { Brand } from './canvas'
import type { RenderedImage } from './templates'

/** Longest side of the output; larger templates are scaled down to this. */
const MAX_OUTPUT = 2400

const imageCache = new Map<string, Promise<Image | null>>()

async function mediaImage(id: string | null | undefined): Promise<Image | null> {
  if (!id) return null
  // Media files are immutable (edits create new ids), so caching by id is safe.
  let p = imageCache.get(id)
  if (!p) {
    p = (async () => {
      const row = await getMedia(id)
      return row ? loadImage(await readMediaFile(row)) : null
    })().catch(() => null)
    imageCache.set(id, p)
    if (imageCache.size > 200) imageCache.delete(imageCache.keys().next().value!)
  }
  return p
}

/** Draw img into the box using CSS object-fit semantics. */
function drawFitted(
  ctx: SKRSContext2D,
  img: Image,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: 'cover' | 'contain',
) {
  const scale =
    fit === 'cover'
      ? Math.max(w / img.width, h / img.height)
      : Math.min(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

function drawText(ctx: SKRSContext2D, layer: TextLayer, vars: Record<string, string>) {
  const text = fillVars(layer.text, vars).trim()
  if (!text) return
  const pad = layer.padding
  const inner = { width: Math.max(10, layer.w - pad * 2), height: Math.max(10, layer.h - pad * 2) }

  let size: number
  let lines: string[]
  let lh: number
  if (layer.minFontSize < layer.fontSize) {
    const fit = fitText(ctx, text, inner, {
      max: layer.fontSize,
      min: layer.minFontSize,
      weight: layer.weight,
      lineHeight: layer.lineHeight,
    })
    size = fit.size
    lines = fit.lines
    lh = fit.lineHeight
  } else {
    size = layer.fontSize
    ctx.font = font(size, layer.weight)
    lines = wrap(ctx, text, inner.width)
    lh = size * layer.lineHeight
  }

  if (layer.bgColor) {
    ctx.fillStyle = layer.bgColor
    roundRect(ctx, layer.x, layer.y, layer.w, layer.h, layer.bgRadius)
    ctx.fill()
  }

  ctx.font = font(size, layer.weight)
  ctx.textAlign = layer.align
  ctx.textBaseline = 'middle'
  const blockH = lines.length * lh
  const top =
    layer.vAlign === 'top'
      ? layer.y + pad
      : layer.vAlign === 'bottom'
        ? layer.y + layer.h - pad - blockH
        : layer.y + (layer.h - blockH) / 2
  const x =
    layer.align === 'left'
      ? layer.x + pad
      : layer.align === 'right'
        ? layer.x + layer.w - pad
        : layer.x + layer.w / 2

  if (layer.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = Math.max(4, size / 5)
    ctx.shadowOffsetY = Math.max(1, size / 18)
  }
  lines.forEach((line, i) => {
    const y = top + i * lh + lh / 2
    if (layer.strokeWidth > 0) {
      ctx.lineJoin = 'round'
      ctx.lineWidth = layer.strokeWidth * 2
      ctx.strokeStyle = layer.strokeColor
      ctx.strokeText(line, x, y)
    }
    ctx.fillStyle = layer.color
    ctx.fillText(line, x, y)
  })
}

async function drawImageLayer(
  ctx: SKRSContext2D,
  layer: ImageLayer,
  input: TemplateInput,
  brand: Brand,
) {
  let img: Image | null | undefined
  if (layer.source === 'logo') img = brand.logo
  else if (layer.source === 'media') img = await mediaImage(layer.mediaId)
  else img = await mediaImage(input.slots[layer.slot])

  const { x, y, w, h } = layer
  const clip = () => {
    ctx.beginPath()
    if (layer.circle) ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    else ctx.roundRect(x, y, w, h, layer.radius)
  }

  ctx.save()
  clip()
  ctx.clip()
  if (img) drawFitted(ctx, img, x, y, w, h, layer.fit)
  else {
    // Visible placeholder so an unfilled slot is obvious in previews.
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = font(Math.max(16, Math.min(w, h) / 8), 700)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(layer.source === 'slot' ? `{${layer.slot}}` : layer.source, x + w / 2, y + h / 2)
  }
  ctx.restore()

  if (layer.borderWidth > 0) {
    clip()
    ctx.lineWidth = layer.borderWidth
    ctx.strokeStyle = layer.borderColor
    ctx.stroke()
  }
}

function drawShape(ctx: SKRSContext2D, layer: ShapeLayer) {
  roundRect(ctx, layer.x, layer.y, layer.w, layer.h, layer.radius)
  if (layer.fill) {
    ctx.fillStyle = layer.fill
    ctx.fill()
  }
  if (layer.strokeWidth > 0) {
    ctx.lineWidth = layer.strokeWidth
    ctx.strokeStyle = layer.strokeColor
    ctx.stroke()
  }
}

async function drawLayer(ctx: SKRSContext2D, layer: Layer, input: TemplateInput, brand: Brand) {
  if (layer.hidden || layer.opacity <= 0) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, layer.opacity)
  if (layer.rotation) {
    const cx = layer.x + layer.w / 2
    const cy = layer.y + layer.h / 2
    ctx.translate(cx, cy)
    ctx.rotate((layer.rotation * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  }
  if (layer.type === 'text') drawText(ctx, layer, input.vars)
  else if (layer.type === 'image') await drawImageLayer(ctx, layer, input, brand)
  else drawShape(ctx, layer)
  ctx.restore()
}

/**
 * Draws the source credit as a band along the bottom edge. Used for rashifal
 * templates unless the template already shows {credit} in a visible text layer.
 */
function drawCreditBand(ctx: SKRSContext2D, credit: string, width: number, height: number) {
  let size = Math.max(14, Math.round(width / 44))
  ctx.font = font(size, 700)
  while (size > 12 && ctx.measureText(credit).width > width * 0.94) ctx.font = font(--size, 700)
  const band = Math.round(size * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, height - band, width, band)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(credit, width / 2, height - band / 2 + 1)
}

export function showsCredit(tpl: Pick<TemplateData, 'layers'>) {
  return tpl.layers.some((l) => l.type === 'text' && !l.hidden && l.opacity > 0.3 && l.text.includes('{credit}'))
}

export async function renderTemplate(
  tpl: TemplateData,
  input: TemplateInput,
  brand: Brand,
  opts: { credit?: string } = {},
): Promise<RenderedImage> {
  ensureFonts()
  const scale = Math.min(1, MAX_OUTPUT / Math.max(tpl.width, tpl.height))
  const outW = Math.round(tpl.width * scale)
  const outH = Math.round(tpl.height * scale)
  const canvas = createCanvas(outW, outH)
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)

  ctx.fillStyle = tpl.backgroundColor || '#1f2937'
  ctx.fillRect(0, 0, tpl.width, tpl.height)
  const bgId = (input.signKey && tpl.signBackgrounds[input.signKey]) || tpl.backgroundMediaId
  const bg = await mediaImage(bgId)
  if (bg) drawFitted(ctx, bg, 0, 0, tpl.width, tpl.height, 'cover')

  for (const layer of tpl.layers) await drawLayer(ctx, layer, input, brand)
  if (opts.credit && !showsCredit(tpl)) drawCreditBand(ctx, opts.credit, tpl.width, tpl.height)

  const data = await canvas.encode('jpeg', 92)
  return { data, mime: 'image/jpeg', width: outW, height: outH }
}
