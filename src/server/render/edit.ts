import { createCanvas, loadImage } from '@napi-rs/canvas'
import type { Image } from '@napi-rs/canvas'
import type { ImageEdits } from '#/lib/types'

export interface EditResult {
  data: Buffer
  mime: 'image/jpeg' | 'image/png'
  width: number
  height: number
}

function filterString(e: ImageEdits) {
  const parts = [
    `brightness(${e.brightness}%)`,
    `contrast(${e.contrast}%)`,
    `saturate(${e.saturation}%)`,
  ]
  if (e.blur > 0) parts.push(`blur(${e.blur}px)`)
  if (e.grayscale) parts.push('grayscale(100%)')
  if (e.sepia) parts.push('sepia(100%)')
  return parts.join(' ')
}

/**
 * Apply edits in a fixed order: rotate/flip → crop → resize → filters → watermark.
 * The browser preview uses the same order so what you see is what you get.
 */
export async function applyEdits(
  source: Buffer,
  edits: ImageEdits,
  opts: { logo?: Image; keepPng?: boolean } = {},
): Promise<EditResult> {
  const img = await loadImage(source)

  // 1. Rotate + flip onto an intermediate canvas.
  const quarter = edits.rotate === 90 || edits.rotate === 270
  const rw = quarter ? img.height : img.width
  const rh = quarter ? img.width : img.height
  const rotated = createCanvas(rw, rh)
  const rctx = rotated.getContext('2d')
  rctx.translate(rw / 2, rh / 2)
  rctx.rotate((edits.rotate * Math.PI) / 180)
  rctx.scale(edits.flipH ? -1 : 1, edits.flipV ? -1 : 1)
  rctx.drawImage(img, -img.width / 2, -img.height / 2)

  // 2. Crop (fractions of the rotated image).
  const c = edits.crop ?? { x: 0, y: 0, w: 1, h: 1 }
  const sx = Math.round(Math.max(0, Math.min(1, c.x)) * rw)
  const sy = Math.round(Math.max(0, Math.min(1, c.y)) * rh)
  const sw = Math.max(1, Math.min(rw - sx, Math.round(c.w * rw)))
  const sh = Math.max(1, Math.min(rh - sy, Math.round(c.h * rh)))

  // 3. Resize.
  const scale = edits.maxSize > 0 ? Math.min(1, edits.maxSize / Math.max(sw, sh)) : 1
  const outW = Math.max(1, Math.round(sw * scale))
  const outH = Math.max(1, Math.round(sh * scale))

  const out = createCanvas(outW, outH)
  const ctx = out.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  // 4. Filters apply while drawing the cropped region.
  ctx.filter = filterString(edits)
  ctx.drawImage(rotated, sx, sy, sw, sh, 0, 0, outW, outH)
  ctx.filter = 'none'

  // 5. Watermark with the brand logo.
  if (edits.watermark && opts.logo) {
    const { position, size, opacity } = edits.watermark
    const logo = opts.logo
    const lw = Math.round(outW * Math.max(0.05, Math.min(0.6, size)))
    const lh = Math.round((logo.height / logo.width) * lw)
    const m = Math.round(outW * 0.035)
    const x = position === 'tl' || position === 'bl' ? m : position === 'center' ? (outW - lw) / 2 : outW - lw - m
    const y = position === 'tl' || position === 'tr' ? m : position === 'center' ? (outH - lh) / 2 : outH - lh - m
    ctx.globalAlpha = Math.max(0.05, Math.min(1, opacity))
    ctx.drawImage(logo, x, y, lw, lh)
    ctx.globalAlpha = 1
  }

  if (opts.keepPng) {
    return { data: await out.encode('png'), mime: 'image/png', width: outW, height: outH }
  }
  return { data: await out.encode('jpeg', 92), mime: 'image/jpeg', width: outW, height: outH }
}
