import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, Undo2 } from 'lucide-react'
import { Button, Field, Modal, Select, Spinner, Toggle, cx, mediaUrl, useAction } from './ui'
import { editMediaFn } from '#/functions/media.functions'
import { DEFAULT_EDITS } from '#/lib/types'
import type { ImageEdits } from '#/lib/types'
import type { Media } from '#/server/db/schema'

type Crop = NonNullable<ImageEdits['crop']>
type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

const ASPECTS: Array<{ label: string; value: number | null }> = [
  { label: 'Free', value: null },
  { label: '1:1 Square', value: 1 },
  { label: '4:5 Portrait (feed)', value: 4 / 5 },
  { label: '9:16 Story', value: 9 / 16 },
  { label: '1.91:1 Landscape', value: 1.91 },
  { label: '16:9 Wide', value: 16 / 9 },
]

const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 }

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

/** Largest centred crop of the given pixel aspect ratio. */
function centredCrop(aspect: number, imgW: number, imgH: number): Crop {
  const imgAspect = imgW / imgH
  if (aspect > imgAspect) {
    const h = imgAspect / aspect
    return { x: 0, y: (1 - h) / 2, w: 1, h }
  }
  const w = aspect / imgAspect
  return { x: (1 - w) / 2, y: 0, w, h: 1 }
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm font-semibold">
        {label}
        <span className="tabular-nums text-muted">
          {value}
          {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </label>
  )
}

export function ImageEditor({
  media,
  logoMediaId,
  onClose,
  onSaved,
}: {
  media: Media | null
  logoMediaId?: string
  onClose: () => void
  onSaved: (m: Media) => void
}) {
  const [edits, setEdits] = useState<ImageEdits>(DEFAULT_EDITS)
  const [crop, setCrop] = useState<Crop>(FULL)
  const [aspect, setAspect] = useState<number | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [logo, setLogo] = useState<HTMLImageElement | null>(null)
  const [wmOn, setWmOn] = useState(false)
  const [wm, setWm] = useState<NonNullable<ImageEdits['watermark']>>({ position: 'br', size: 0.18, opacity: 0.85 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ handle: Handle; startX: number; startY: number; start: Crop } | null>(null)
  const { busy, run } = useAction()

  useEffect(() => {
    if (!media) return
    setEdits(DEFAULT_EDITS)
    setCrop(FULL)
    setAspect(null)
    setWmOn(false)
    setImg(null)
    const el = new Image()
    el.onload = () => setImg(el)
    el.src = mediaUrl(media.id)
  }, [media])

  useEffect(() => {
    if (!logoMediaId) return setLogo(null)
    const el = new Image()
    el.onload = () => setLogo(el)
    el.src = mediaUrl(logoMediaId)
  }, [logoMediaId])

  const quarter = edits.rotate === 90 || edits.rotate === 270
  const rw = img ? (quarter ? img.height : img.width) : 1
  const rh = img ? (quarter ? img.width : img.height) : 1

  // Draw the rotated/flipped image; filters are previewed with CSS on the canvas.
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !img) return
    const scale = Math.min(1, 1400 / Math.max(rw, rh))
    c.width = Math.round(rw * scale)
    c.height = Math.round(rh * scale)
    const ctx = c.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.translate(c.width / 2, c.height / 2)
    ctx.rotate((edits.rotate * Math.PI) / 180)
    ctx.scale(edits.flipH ? -1 : 1, edits.flipV ? -1 : 1)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
  }, [img, edits.rotate, edits.flipH, edits.flipV, rw, rh])

  const cssFilter = useMemo(() => {
    const parts = [`brightness(${edits.brightness}%)`, `contrast(${edits.contrast}%)`, `saturate(${edits.saturation}%)`]
    if (edits.blur) parts.push(`blur(${Math.max(0.5, edits.blur * 0.4)}px)`)
    if (edits.grayscale) parts.push('grayscale(100%)')
    if (edits.sepia) parts.push('sepia(100%)')
    return parts.join(' ')
  }, [edits])

  function applyAspect(a: number | null) {
    setAspect(a)
    setCrop(a ? centredCrop(a, rw, rh) : FULL)
  }

  function rotate(delta: 90 | -90) {
    setEdits((e) => ({ ...e, rotate: (((e.rotate + delta) % 360) + 360) % 360 as ImageEdits['rotate'] }))
    setCrop(FULL)
    setAspect(null)
  }

  function onPointerDown(handle: Handle) {
    return (e: ReactPointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      drag.current = { handle, startX: e.clientX, startY: e.clientY, start: crop }
    }
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current
    const box = boxRef.current?.getBoundingClientRect()
    if (!d || !box) return
    const dx = (e.clientX - d.startX) / box.width
    const dy = (e.clientY - d.startY) / box.height
    const s = d.start
    const MIN = 0.05
    if (d.handle === 'move') {
      setCrop({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) })
      return
    }
    // Resize from the dragged corner, keeping the opposite corner fixed.
    const west = d.handle === 'nw' || d.handle === 'sw'
    const north = d.handle === 'nw' || d.handle === 'ne'
    const fixedX = west ? s.x + s.w : s.x
    const fixedY = north ? s.y + s.h : s.y
    let w = clamp(west ? s.w - dx : s.w + dx, MIN, west ? fixedX : 1 - fixedX)
    let h = clamp(north ? s.h - dy : s.h + dy, MIN, north ? fixedY : 1 - fixedY)
    if (aspect) {
      // Keep pixel aspect: (w*rw)/(h*rh) = aspect
      const hForW = (w * rw) / (aspect * rh)
      const maxH = north ? fixedY : 1 - fixedY
      if (hForW <= maxH) h = hForW
      else {
        h = maxH
        w = (h * aspect * rh) / rw
      }
    }
    setCrop({ x: west ? fixedX - w : fixedX, y: north ? fixedY - h : fixedY, w, h })
  }

  const outW = Math.round(crop.w * rw)
  const outH = Math.round(crop.h * rh)
  const finalScale = edits.maxSize ? Math.min(1, edits.maxSize / Math.max(outW, outH)) : 1

  async function save() {
    if (!media) return
    const payload: ImageEdits = {
      ...edits,
      crop: crop.w > 0.999 && crop.h > 0.999 ? undefined : crop,
      watermark: wmOn ? wm : undefined,
    }
    const saved = await run('save', () => editMediaFn({ data: { mediaId: media.id, edits: payload } }), 'Saved as a new image')
    if (saved) {
      onSaved(saved)
      onClose()
    }
  }

  const wmStyle = (() => {
    if (!logo) return {}
    const widthPct = wm.size * 100
    const m = 3.5
    const pos: Record<string, string> = {}
    if (wm.position === 'center') {
      pos.left = `${50 - widthPct / 2}%`
      pos.top = '50%'
      pos.transform = 'translateY(-50%)'
    } else {
      pos[wm.position.includes('l') ? 'left' : 'right'] = `${m}%`
      pos[wm.position.includes('t') ? 'top' : 'bottom'] = `${m * (outW / Math.max(1, outH))}%`
    }
    return { width: `${widthPct}%`, opacity: wm.opacity, ...pos }
  })()

  return (
    <Modal
      open={!!media}
      onClose={onClose}
      title="Edit image"
      size="xl"
      footer={
        <>
          <span className="mr-auto self-center text-sm text-muted">
            Output: {Math.round(outW * finalScale)} × {Math.round(outH * finalScale)} px · original is kept
          </span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy === 'save'} onClick={save} disabled={!img}>Save copy</Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="checker flex min-h-[320px] items-center justify-center rounded-xl p-4">
          {!img ? (
            <Spinner />
          ) : (
            <div ref={boxRef} className="relative inline-block max-w-full touch-none select-none" onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}>
              <canvas ref={canvasRef} className="block max-h-[60vh] max-w-full" style={{ filter: cssFilter }} />
              {/* Dim outside the crop */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-0 top-0 bg-black/55" style={{ height: `${crop.y * 100}%` }} />
                <div className="absolute inset-x-0 bottom-0 bg-black/55" style={{ height: `${(1 - crop.y - crop.h) * 100}%` }} />
                <div className="absolute left-0 bg-black/55" style={{ top: `${crop.y * 100}%`, height: `${crop.h * 100}%`, width: `${crop.x * 100}%` }} />
                <div className="absolute right-0 bg-black/55" style={{ top: `${crop.y * 100}%`, height: `${crop.h * 100}%`, width: `${(1 - crop.x - crop.w) * 100}%` }} />
              </div>
              <div
                className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
                onPointerDown={onPointerDown('move')}
              >
                {/* Rule of thirds */}
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border border-white/25" />
                  ))}
                </div>
                {wmOn && logo && <img src={logo.src} alt="" className="pointer-events-none absolute" style={wmStyle} />}
                {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
                  <span
                    key={h}
                    onPointerDown={onPointerDown(h)}
                    className={cx(
                      'absolute size-4 rounded-sm border-2 border-accent bg-white',
                      h === 'nw' && '-left-2 -top-2 cursor-nwse-resize',
                      h === 'ne' && '-right-2 -top-2 cursor-nesw-resize',
                      h === 'sw' && '-bottom-2 -left-2 cursor-nesw-resize',
                      h === 'se' && '-bottom-2 -right-2 cursor-nwse-resize',
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <Field label="Crop">
            <Select value={aspect ?? ''} onChange={(e) => applyAspect(e.target.value ? Number(e.target.value) : null)}>
              {ASPECTS.map((a) => (
                <option key={a.label} value={a.value ?? ''}>{a.label}</option>
              ))}
            </Select>
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-semibold">Rotate & flip</p>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" icon={<RotateCcw className="size-4" />} onClick={() => rotate(-90)} aria-label="Rotate left" />
              <Button size="sm" icon={<RotateCw className="size-4" />} onClick={() => rotate(90)} aria-label="Rotate right" />
              <Button size="sm" variant={edits.flipH ? 'primary' : 'secondary'} icon={<FlipHorizontal2 className="size-4" />} onClick={() => setEdits((e) => ({ ...e, flipH: !e.flipH }))} aria-label="Flip horizontal" />
              <Button size="sm" variant={edits.flipV ? 'primary' : 'secondary'} icon={<FlipVertical2 className="size-4" />} onClick={() => setEdits((e) => ({ ...e, flipV: !e.flipV }))} aria-label="Flip vertical" />
            </div>
          </div>

          <div className="space-y-3">
            <Slider label="Brightness" value={edits.brightness} min={30} max={200} unit="%" onChange={(v) => setEdits((e) => ({ ...e, brightness: v }))} />
            <Slider label="Contrast" value={edits.contrast} min={30} max={200} unit="%" onChange={(v) => setEdits((e) => ({ ...e, contrast: v }))} />
            <Slider label="Saturation" value={edits.saturation} min={0} max={250} unit="%" onChange={(v) => setEdits((e) => ({ ...e, saturation: v }))} />
            <Slider label="Blur" value={edits.blur} min={0} max={20} unit="px" onChange={(v) => setEdits((e) => ({ ...e, blur: v }))} />
            <div className="flex flex-wrap gap-4 pt-1">
              <Toggle checked={edits.grayscale} onChange={(v) => setEdits((e) => ({ ...e, grayscale: v }))} label="Black & white" />
              <Toggle checked={edits.sepia} onChange={(v) => setEdits((e) => ({ ...e, sepia: v }))} label="Sepia" />
            </div>
          </div>

          <Field label="Max size" hint="Facebook shows images up to 2048px; larger just slows uploads.">
            <Select value={edits.maxSize} onChange={(e) => setEdits((x) => ({ ...x, maxSize: Number(e.target.value) }))}>
              <option value={0}>Keep original</option>
              <option value={2048}>2048 px</option>
              <option value={1440}>1440 px</option>
              <option value={1080}>1080 px</option>
            </Select>
          </Field>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <Toggle checked={wmOn} onChange={setWmOn} disabled={!logo} label="Logo watermark" />
            {!logo && <p className="text-[13px] text-muted">Upload a logo in Settings to enable.</p>}
            {wmOn && logo && (
              <>
                <Select value={wm.position} onChange={(e) => setWm((w) => ({ ...w, position: e.target.value as typeof w.position }))}>
                  <option value="br">Bottom right</option>
                  <option value="bl">Bottom left</option>
                  <option value="tr">Top right</option>
                  <option value="tl">Top left</option>
                  <option value="center">Centre</option>
                </Select>
                <Slider label="Size" value={Math.round(wm.size * 100)} min={5} max={60} unit="%" onChange={(v) => setWm((w) => ({ ...w, size: v / 100 }))} />
                <Slider label="Opacity" value={Math.round(wm.opacity * 100)} min={10} max={100} unit="%" onChange={(v) => setWm((w) => ({ ...w, opacity: v / 100 }))} />
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            icon={<Undo2 className="size-4" />}
            onClick={() => {
              setEdits(DEFAULT_EDITS)
              setCrop(FULL)
              setAspect(null)
              setWmOn(false)
            }}
          >
            Reset all
          </Button>
        </div>
      </div>
    </Modal>
  )
}
