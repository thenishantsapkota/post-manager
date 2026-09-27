import { Link, createFileRoute, useBlocker, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  ImagePlus,
  Save,
  Square,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { MediaPicker } from '#/components/media-picker'
import { ZodiacIcon } from '#/components/zodiac-icon'
import { Badge, Button, Card, Field, Input, Modal, Select, Spinner, Textarea, Toggle, cx, mediaUrl, useAction } from '#/components/ui'
import { getTemplateFn, previewTemplateFn, saveTemplateFn } from '#/functions/templates.functions'
import { SIGNS } from '#/lib/signs'
import { KIND_LABELS } from '#/lib/template-presets'
import { builtinVars, fillVars, newLayer, sampleVars, templateFields } from '#/lib/template-vars'
import type { ImageLayer, Layer, ShapeLayer, TemplateData, TextLayer } from '#/lib/types'

export const Route = createFileRoute('/_app/templates/$id')({
  loader: ({ params }) => getTemplateFn({ data: { id: params.id } }),
  component: TemplateEditorPage,
})

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

function TemplateEditorPage() {
  const loaded = Route.useLoaderData()
  const router = useRouter()
  const { id, ...initial } = loaded
  const [tpl, setTpl] = useState<TemplateData>(initial)
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNames, setShowNames] = useState(false)
  const [previewSign, setPreviewSign] = useState<string>('mesh')
  const [exact, setExact] = useState<string | null>(null)
  const [exactOpen, setExactOpen] = useState(false)
  const [picker, setPicker] = useState<null | { kind: 'bg' } | { kind: 'sign'; sign: string } | { kind: 'layer'; layerId: string }>(null)
  const { busy, run } = useAction()

  const dirty = JSON.stringify(tpl) !== savedJson
  useBlocker({ shouldBlockFn: () => dirty && !confirm('You have unsaved changes. Leave anyway?'), enableBeforeUnload: () => dirty })

  const selected = tpl.layers.find((l) => l.id === selectedId) ?? null
  const samples = useMemo(() => sampleVars(tpl.kind), [tpl.kind])
  const fields = useMemo(() => templateFields(tpl), [tpl])

  const updateLayer = useCallback((layerId: string, patch: Partial<Layer>) => {
    setTpl((t) => ({ ...t, layers: t.layers.map((l) => (l.id === layerId ? ({ ...l, ...patch } as Layer) : l)) }))
  }, [])

  function addLayer(type: Layer['type']) {
    const layer = newLayer(type, tpl)
    setTpl((t) => ({ ...t, layers: [...t.layers, layer] }))
    setSelectedId(layer.id)
  }

  function moveLayer(layerId: string, dir: -1 | 1) {
    setTpl((t) => {
      const i = t.layers.findIndex((l) => l.id === layerId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= t.layers.length) return t
      const layers = [...t.layers]
      ;[layers[i], layers[j]] = [layers[j], layers[i]]
      return { ...t, layers }
    })
  }

  function duplicateLayer(l: Layer) {
    const copy = { ...l, id: newLayer(l.type, tpl).id, name: `${l.name} copy`, x: l.x + 20, y: l.y + 20 } as Layer
    setTpl((t) => ({ ...t, layers: [...t.layers, copy] }))
    setSelectedId(copy.id)
  }

  function removeLayer(layerId: string) {
    setTpl((t) => ({ ...t, layers: t.layers.filter((l) => l.id !== layerId) }))
    setSelectedId(null)
  }

  // Keyboard: arrows nudge (shift = 10px), Delete removes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selected) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const step = e.shiftKey ? 10 : 1
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (moves[e.key]) {
        e.preventDefault()
        updateLayer(selected.id, { x: selected.x + moves[e.key][0], y: selected.y + moves[e.key][1] })
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeLayer(selected.id)
      } else if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function save() {
    const res = await run('save', () => saveTemplateFn({ data: { id, data: tpl } }), 'Template saved')
    if (res) {
      setSavedJson(JSON.stringify(tpl))
      await router.invalidate()
    }
  }

  async function exactPreview() {
    setExactOpen(true)
    setExact(null)
    const res = await run('preview', () =>
      previewTemplateFn({ data: { data: tpl, input: { vars: {}, slots: {}, signKey: tpl.kind === 'rashifal_sign' ? previewSign : undefined } } }),
    )
    setExact(res?.dataUrl ?? '')
  }

  const bgId = (tpl.kind === 'rashifal_sign' && tpl.signBackgrounds[previewSign]) || tpl.backgroundMediaId

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 lg:-my-8">
      {/* Toolbar */}
      <div className="sticky top-[53px] z-20 flex flex-wrap items-center gap-2 border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:top-0 lg:px-8">
        <Link to="/templates" className="rounded-md p-1.5 text-muted hover:bg-surface-2" aria-label="Back to templates">
          <ArrowLeft className="size-5" />
        </Link>
        <Input className="h-9 w-auto min-w-40 flex-1 font-semibold sm:max-w-xs" value={tpl.name} onChange={(e) => setTpl((t) => ({ ...t, name: e.target.value }))} />
        <Badge tone="accent">{KIND_LABELS[tpl.kind]}</Badge>
        <span className="hidden text-sm text-muted md:inline">{tpl.width}×{tpl.height}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Toggle checked={showNames} onChange={setShowNames} label={<span className="hidden sm:inline">Show {'{variables}'}</span>} />
          <Button size="sm" icon={<Eye className="size-4" />} onClick={exactPreview}>Exact preview</Button>
          <Button size="sm" variant="primary" icon={<Save className="size-4" />} loading={busy === 'save'} disabled={!dirty} onClick={save}>
            {dirty ? 'Save' : 'Saved'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[220px_1fr_300px] lg:p-8">
        {/* Layers */}
        <Card className="h-fit">
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-sm font-bold">Layers</p>
            <div className="mt-2 grid grid-cols-3 gap-1">
              <Button size="sm" icon={<Type className="size-4" />} onClick={() => addLayer('text')} aria-label="Add text" title="Add text" />
              <Button size="sm" icon={<ImageIcon className="size-4" />} onClick={() => addLayer('image')} aria-label="Add image" title="Add image" />
              <Button size="sm" icon={<Square className="size-4" />} onClick={() => addLayer('shape')} aria-label="Add shape" title="Add box" />
            </div>
          </div>
          <ul className="max-h-[50vh] overflow-y-auto p-1.5">
            {[...tpl.layers].reverse().map((l) => {
              const Icon = l.type === 'text' ? Type : l.type === 'image' ? ImageIcon : Square
              return (
                <li key={l.id}>
                  <div
                    className={cx(
                      'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                      selectedId === l.id ? 'bg-accent-soft text-accent' : 'hover:bg-surface-2',
                      l.hidden && 'opacity-50',
                    )}
                    onClick={() => setSelectedId(l.id)}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
                    <button
                      type="button"
                      className="rounded p-0.5 text-muted hover:text-fg"
                      aria-label={l.hidden ? 'Show layer' : 'Hide layer'}
                      onClick={(e) => {
                        e.stopPropagation()
                        updateLayer(l.id, { hidden: !l.hidden })
                      }}
                    >
                      {l.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </li>
              )
            })}
            {tpl.layers.length === 0 && <li className="px-2 py-3 text-sm text-muted">No layers. Add one above.</li>}
          </ul>
          <div className="border-t border-border px-3 py-2.5 text-[12px] leading-snug text-muted">Top of the list is drawn on top. Arrow keys nudge, Shift for 10px.</div>
        </Card>

        {/* Stage */}
        <div className="min-w-0">
          {tpl.kind === 'rashifal_sign' && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-muted">Preview sign:</span>
              <Select className="h-9 w-auto" value={previewSign} onChange={(e) => setPreviewSign(e.target.value)}>
                {SIGNS.map((s) => <option key={s.key} value={s.key}>{s.np} · {s.en}</option>)}
              </Select>
            </div>
          )}
          <Stage
            tpl={tpl}
            bgId={bgId}
            vars={{ ...samples, ...(tpl.kind === 'rashifal_sign' ? signVars(previewSign) : {}) }}
            showNames={showNames}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={updateLayer}
          />
          {tpl.kind !== 'general' && !tpl.layers.some((l) => l.type === 'text' && !l.hidden && l.text.includes('{credit}')) && (
            <p className="mt-3 rounded-lg bg-info-soft px-3 py-2 text-sm text-info">
              No visible {'{credit}'} layer, so a Nepali Patro credit strip is added along the bottom automatically. Add a text layer with {'{credit}'} to place it yourself.
            </p>
          )}
        </div>

        {/* Properties */}
        <div className="space-y-4">
          {selected ? (
            <Card>
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <Input className="h-8 font-semibold" value={selected.name} onChange={(e) => updateLayer(selected.id, { name: e.target.value })} />
                <button type="button" className="ml-2 rounded p-1 text-muted hover:bg-surface-2" onClick={() => setSelectedId(null)} aria-label="Deselect">
                  <X className="size-4" />
                </button>
              </div>
              <div className="space-y-4 p-4">
                <div className="flex gap-1">
                  <Button size="sm" icon={<ArrowUp className="size-4" />} onClick={() => moveLayer(selected.id, 1)} title="Bring forward" aria-label="Bring forward" />
                  <Button size="sm" icon={<ArrowDown className="size-4" />} onClick={() => moveLayer(selected.id, -1)} title="Send backward" aria-label="Send backward" />
                  <Button size="sm" icon={<Copy className="size-4" />} onClick={() => duplicateLayer(selected)} title="Duplicate" aria-label="Duplicate" />
                  <Button size="sm" variant="danger" icon={<Trash2 className="size-4" />} onClick={() => removeLayer(selected.id)} title="Delete" aria-label="Delete" />
                </div>
                <GeometryFields layer={selected} tpl={tpl} onChange={(p) => updateLayer(selected.id, p)} />
                {selected.type === 'text' && <TextFields layer={selected} kind={tpl.kind} onChange={(p) => updateLayer(selected.id, p)} />}
                {selected.type === 'image' && (
                  <ImageFields layer={selected} onChange={(p) => updateLayer(selected.id, p)} onPick={() => setPicker({ kind: 'layer', layerId: selected.id })} />
                )}
                {selected.type === 'shape' && <ShapeFields layer={selected} onChange={(p) => updateLayer(selected.id, p)} />}
              </div>
            </Card>
          ) : (
            <Card>
              <div className="border-b border-border px-4 py-2.5"><p className="font-bold">Template</p></div>
              <div className="space-y-4 p-4">
                <div>
                  <p className="mb-1.5 text-sm font-semibold">Background design</p>
                  <button type="button" onClick={() => setPicker({ kind: 'bg' })} className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-2 text-left hover:bg-surface-2">
                    {tpl.backgroundMediaId ? <img src={mediaUrl(tpl.backgroundMediaId)} alt="" className="size-14 rounded object-cover" /> : <div className="grid size-14 place-items-center rounded bg-surface-2 text-muted"><ImagePlus className="size-5" /></div>}
                    <span className="text-sm text-muted">{tpl.backgroundMediaId ? 'Change' : 'Choose or upload'}</span>
                  </button>
                  {tpl.backgroundMediaId && (
                    <button type="button" className="mt-1 text-sm text-muted hover:text-bad" onClick={() => setTpl((t) => ({ ...t, backgroundMediaId: null }))}>Remove background</button>
                  )}
                </div>
                <Field label="Fallback colour">
                  <ColorInput value={tpl.backgroundColor} onChange={(v) => setTpl((t) => ({ ...t, backgroundColor: v }))} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Width"><Input type="number" value={tpl.width} min={100} max={4000} onChange={(e) => setTpl((t) => ({ ...t, width: clampInt(e.target.value, 100, 4000) }))} /></Field>
                  <Field label="Height"><Input type="number" value={tpl.height} min={100} max={4000} onChange={(e) => setTpl((t) => ({ ...t, height: clampInt(e.target.value, 100, 4000) }))} /></Field>
                </div>

                {tpl.kind === 'rashifal_sign' && (
                  <div>
                    <p className="text-sm font-semibold">Per-sign backgrounds</p>
                    <p className="mb-2 text-[13px] text-muted">Optional: a different design for each rashi. Signs without one use the main background.</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {SIGNS.map((s) => {
                        const bid = tpl.signBackgrounds[s.key]
                        return (
                          <div key={s.key} className="relative">
                            <button
                              type="button"
                              onClick={() => setPicker({ kind: 'sign', sign: s.key })}
                              className={cx('grid aspect-square w-full place-items-center overflow-hidden rounded-md border text-xs font-bold', bid ? 'border-accent' : 'border-dashed border-border text-muted hover:bg-surface-2')}
                              title={s.en}
                            >
                              {bid ? (
                                <img src={mediaUrl(bid)} alt={s.np} className="size-full object-cover" />
                              ) : (
                                <span className="flex flex-col items-center gap-0.5">
                                  <ZodiacIcon sign={s.key} className="size-4" />
                                  {s.np}
                                </span>
                              )}
                            </button>
                            {bid && (
                              <button
                                type="button"
                                aria-label={`Remove ${s.en} background`}
                                className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-fg text-bg"
                                onClick={() =>
                                  setTpl((t) => {
                                    const next = { ...t.signBackgrounds }
                                    delete next[s.key]
                                    return { ...t, signBackgrounds: next }
                                  })
                                }
                              >
                                <X className="size-3" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card>
            <div className="border-b border-border px-4 py-2.5"><p className="font-bold">Variables</p></div>
            <div className="space-y-3 p-4 text-sm">
              <p className="text-[13px] text-muted">Type these into text layers. They're filled in when the image is made.</p>
              <ul className="space-y-1.5">
                {builtinVars(tpl.kind).map((v) => (
                  <li key={v.key} className="flex items-baseline justify-between gap-2">
                    <button
                      type="button"
                      className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] hover:bg-accent-soft"
                      title="Copy"
                      onClick={() => {
                        if (selected?.type === 'text') updateLayer(selected.id, { text: `${selected.text}{${v.key}}` })
                        else navigator.clipboard?.writeText(`{${v.key}}`)
                      }}
                    >
                      {`{${v.key}}`}
                    </button>
                    <span className="text-right text-[12px] text-muted">{v.label}</span>
                  </li>
                ))}
              </ul>
              {(fields.vars.length > 0 || fields.slots.length > 0) && (
                <div className="border-t border-border pt-3">
                  <p className="mb-1 text-[13px] font-semibold">Asked for when used</p>
                  <p className="text-[13px] text-muted">
                    {[...fields.vars.map((v) => `{${v}}`), ...fields.slots.map((s) => `${s} image`)].join(', ')}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <MediaPicker
        open={!!picker}
        onClose={() => setPicker(null)}
        title={picker?.kind === 'layer' ? 'Choose image' : 'Choose background design'}
        onPick={(m) => {
          const mid = m[0].id
          if (picker?.kind === 'bg') setTpl((t) => ({ ...t, backgroundMediaId: mid }))
          else if (picker?.kind === 'sign') setTpl((t) => ({ ...t, signBackgrounds: { ...t.signBackgrounds, [picker.sign]: mid } }))
          else if (picker?.kind === 'layer') updateLayer(picker.layerId, { mediaId: mid, source: 'media' } as Partial<ImageLayer>)
        }}
      />

      <Modal open={exactOpen} onClose={() => setExactOpen(false)} title="Exact preview" size="lg">
        <div className="checker grid place-items-center rounded-xl p-3">
          {exact ? <img src={exact} alt="Rendered template" className="max-h-[70vh] w-auto" /> : exact === '' ? <p className="py-10 text-bad">Preview failed</p> : <div className="py-16"><Spinner /></div>}
        </div>
        <p className="mt-3 text-sm text-muted">Rendered by the same engine that makes the posts, using sample text. Long text shrinks to fit its box down to the minimum size.</p>
      </Modal>
    </div>
  )
}

function signVars(key: string) {
  const s = SIGNS.find((x) => x.key === key)!
  return { sign_np: s.np, sign_en: s.en, sign_letters: s.letters }
}

function clampInt(v: string, min: number, max: number) {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min
}

// ---------------------------------------------------------------------------
// Stage: HTML approximation of the canvas for fast, direct manipulation.
// ---------------------------------------------------------------------------

function Stage({
  tpl,
  bgId,
  vars,
  showNames,
  selectedId,
  onSelect,
  onChange,
}: {
  tpl: TemplateData
  bgId: string | null
  vars: Record<string, string>
  showNames: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChange: (id: string, patch: Partial<Layer>) => void
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  const drag = useRef<{ id: string; handle: Handle; sx: number; sy: number; start: Layer } | null>(null)
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false })

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const update = () => {
      const maxH = window.innerHeight * 0.78
      setScale(Math.min(el.clientWidth / tpl.width, maxH / tpl.height))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [tpl.width, tpl.height])

  function down(layer: Layer, handle: Handle) {
    return (e: ReactPointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      onSelect(layer.id)
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      drag.current = { id: layer.id, handle, sx: e.clientX, sy: e.clientY, start: layer }
    }
  }

  function move(e: ReactPointerEvent) {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.sx) / scale
    const dy = (e.clientY - d.sy) / scale
    const s = d.start
    if (d.handle === 'move') {
      let x = Math.round(s.x + dx)
      let y = Math.round(s.y + dy)
      // Snap the layer centre to the canvas centre lines.
      const snap = 8 / scale
      const cxDist = x + s.w / 2 - tpl.width / 2
      const cyDist = y + s.h / 2 - tpl.height / 2
      const v = Math.abs(cxDist) < snap
      const h = Math.abs(cyDist) < snap
      if (v) x = Math.round(tpl.width / 2 - s.w / 2)
      if (h) y = Math.round(tpl.height / 2 - s.h / 2)
      setGuides({ v, h })
      onChange(d.id, { x, y })
      return
    }
    const west = d.handle === 'nw' || d.handle === 'sw'
    const north = d.handle === 'nw' || d.handle === 'ne'
    const w = Math.max(10, Math.round(west ? s.w - dx : s.w + dx))
    const h = Math.max(10, Math.round(north ? s.h - dy : s.h + dy))
    onChange(d.id, { w, h, x: west ? s.x + s.w - w : s.x, y: north ? s.y + s.h - h : s.y })
  }

  function up() {
    drag.current = null
    setGuides({ v: false, h: false })
  }

  return (
    <div ref={wrap} className="w-full">
      <div
        className="checker relative mx-auto touch-none select-none overflow-hidden rounded-lg shadow-sm ring-1 ring-border"
        style={{ width: tpl.width * scale, height: tpl.height * scale, background: tpl.backgroundColor }}
        onPointerDown={() => onSelect(null)}
        onPointerMove={move}
        onPointerUp={up}
      >
        {bgId && <img src={mediaUrl(bgId)} alt="" className="pointer-events-none absolute inset-0 size-full object-cover" draggable={false} />}
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: tpl.width, height: tpl.height, transform: `scale(${scale})` }}>
          {tpl.layers.map((l) => (
            <div
              key={l.id}
              onPointerDown={down(l, 'move')}
              className={cx('absolute cursor-move', l.hidden && 'hidden')}
              style={{
                left: l.x,
                top: l.y,
                width: l.w,
                height: l.h,
                opacity: l.opacity,
                transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined,
              }}
            >
              <LayerView layer={l} vars={vars} showNames={showNames} />
              {selectedId === l.id && (
                <div className="pointer-events-none absolute inset-0" style={{ outline: `${2 / scale}px solid #fb7185`, outlineOffset: 0 }}>
                  {(['nw', 'ne', 'sw', 'se'] as const).map((hnd) => (
                    <span
                      key={hnd}
                      onPointerDown={down(l, hnd)}
                      className="pointer-events-auto absolute rounded-sm border-accent bg-white"
                      style={{
                        width: 14 / scale,
                        height: 14 / scale,
                        borderWidth: 2 / scale,
                        left: hnd.includes('w') ? -7 / scale : undefined,
                        right: hnd.includes('e') ? -7 / scale : undefined,
                        top: hnd.includes('n') ? -7 / scale : undefined,
                        bottom: hnd.includes('s') ? -7 / scale : undefined,
                        cursor: hnd === 'nw' || hnd === 'se' ? 'nwse-resize' : 'nesw-resize',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {guides.v && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-accent" />}
        {guides.h && <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-accent" />}
      </div>
      <p className="mt-2 text-center text-[13px] text-muted">Approximate live view · use “Exact preview” to see the final render</p>
    </div>
  )
}

function LayerView({ layer, vars, showNames }: { layer: Layer; vars: Record<string, string>; showNames: boolean }) {
  if (layer.type === 'shape') {
    return (
      <div
        className="size-full"
        style={{ background: layer.fill, borderRadius: layer.radius, border: layer.strokeWidth ? `${layer.strokeWidth}px solid ${layer.strokeColor}` : undefined }}
      />
    )
  }
  if (layer.type === 'image') {
    const src = layer.source === 'media' && layer.mediaId ? mediaUrl(layer.mediaId) : null
    const style: CSSProperties = {
      borderRadius: layer.circle ? '50%' : layer.radius,
      border: layer.borderWidth ? `${layer.borderWidth}px solid ${layer.borderColor}` : undefined,
    }
    return src ? (
      <img src={src} alt="" draggable={false} className="size-full" style={{ ...style, objectFit: layer.fit }} />
    ) : (
      <div className="grid size-full place-items-center bg-white/25 font-bold text-white" style={{ ...style, fontSize: Math.max(16, Math.min(layer.w, layer.h) / 8) }}>
        {layer.source === 'logo' ? 'logo' : `{${layer.slot}}`}
      </div>
    )
  }
  const text = showNames ? layer.text : fillVars(layer.text, vars)
  const justify = layer.vAlign === 'top' ? 'flex-start' : layer.vAlign === 'bottom' ? 'flex-end' : 'center'
  return (
    <div
      className="flex size-full flex-col overflow-hidden"
      style={{
        justifyContent: justify,
        padding: layer.padding,
        background: layer.bgColor || undefined,
        borderRadius: layer.bgColor ? layer.bgRadius : undefined,
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: 'Mukta, sans-serif',
          fontSize: layer.fontSize,
          fontWeight: layer.weight,
          lineHeight: layer.lineHeight,
          color: layer.color,
          textAlign: layer.align,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          textShadow: layer.shadow ? `0 ${Math.max(1, layer.fontSize / 18)}px ${Math.max(4, layer.fontSize / 5)}px rgba(0,0,0,0.5)` : undefined,
          WebkitTextStroke: layer.strokeWidth ? `${layer.strokeWidth}px ${layer.strokeColor}` : undefined,
          paintOrder: 'stroke fill',
        }}
      >
        {text}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Property panels
// ---------------------------------------------------------------------------

function NumberField({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-muted">{label}</span>
      <Input
        type="number"
        className="h-8 px-2 text-sm"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(min !== undefined ? Math.max(min, max !== undefined ? Math.min(max, n) : n) : n)
        }}
      />
    </label>
  )
}

function ColorInput({ value, onChange, allowNone }: { value: string; onChange: (v: string) => void; allowNone?: boolean }) {
  const isHex = /^#[0-9a-f]{6}$/i.test(value)
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={isHex ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-surface" />
      <Input className="h-8 px-2 font-mono text-[13px]" value={value} placeholder={allowNone ? 'none' : ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-[12px] font-bold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  )
}

function GeometryFields({ layer, tpl, onChange }: { layer: Layer; tpl: TemplateData; onChange: (p: Partial<Layer>) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        <NumberField label="X" value={layer.x} onChange={(x) => onChange({ x })} />
        <NumberField label="Y" value={layer.y} onChange={(y) => onChange({ y })} />
        <NumberField label="W" value={layer.w} min={10} onChange={(w) => onChange({ w })} />
        <NumberField label="H" value={layer.h} min={10} onChange={(h) => onChange({ h })} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="Rotation °" value={layer.rotation} min={-360} max={360} onChange={(rotation) => onChange({ rotation })} />
        <NumberField label="Opacity %" value={Math.round(layer.opacity * 100)} min={0} max={100} onChange={(v) => onChange({ opacity: v / 100 })} />
      </div>
      <div className="flex gap-1">
        <Button size="sm" className="flex-1" onClick={() => onChange({ x: Math.round((tpl.width - layer.w) / 2) })}>Centre H</Button>
        <Button size="sm" className="flex-1" onClick={() => onChange({ y: Math.round((tpl.height - layer.h) / 2) })}>Centre V</Button>
      </div>
    </div>
  )
}

function TextFields({ layer, kind, onChange }: { layer: TextLayer; kind: TemplateData['kind']; onChange: (p: Partial<TextLayer>) => void }) {
  return (
    <>
      <Section title="Text">
        <Textarea rows={3} value={layer.text} onChange={(e) => onChange({ text: e.target.value })} />
        {kind !== 'general' && !layer.text.includes('{') && <p className="text-[12px] text-muted">Tip: use {'{rashifal}'} or {'{sign_np}'} so the text changes per sign.</p>}
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField label="Size" value={layer.fontSize} min={6} max={600} onChange={(fontSize) => onChange({ fontSize, minFontSize: Math.min(layer.minFontSize, fontSize) })} />
          <NumberField label="Min size (auto-fit)" value={layer.minFontSize} min={6} max={layer.fontSize} onChange={(minFontSize) => onChange({ minFontSize })} />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-muted">Weight</span>
            <Select className="h-8 px-2 text-sm" value={layer.weight} onChange={(e) => onChange({ weight: Number(e.target.value) as TextLayer['weight'] })}>
              <option value={400}>Regular</option>
              <option value={700}>Bold</option>
              <option value={800}>Extra bold</option>
            </Select>
          </label>
          <NumberField label="Line height" value={layer.lineHeight} min={0.8} max={3} step={0.05} onChange={(lineHeight) => onChange({ lineHeight })} />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-muted">Align</span>
            <Select className="h-8 px-2 text-sm" value={layer.align} onChange={(e) => onChange({ align: e.target.value as TextLayer['align'] })}>
              <option value="left">Left</option>
              <option value="center">Centre</option>
              <option value="right">Right</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-muted">Vertical</span>
            <Select className="h-8 px-2 text-sm" value={layer.vAlign} onChange={(e) => onChange({ vAlign: e.target.value as TextLayer['vAlign'] })}>
              <option value="top">Top</option>
              <option value="middle">Middle</option>
              <option value="bottom">Bottom</option>
            </Select>
          </label>
        </div>
        <Field label="Colour"><ColorInput value={layer.color} onChange={(color) => onChange({ color })} /></Field>
      </Section>
      <Section title="Effects">
        <Toggle checked={layer.shadow} onChange={(shadow) => onChange({ shadow })} label="Drop shadow" />
        <div className="grid grid-cols-[1fr_80px] items-end gap-1.5">
          <Field label="Outline"><ColorInput value={layer.strokeColor} onChange={(strokeColor) => onChange({ strokeColor })} /></Field>
          <NumberField label="Width" value={layer.strokeWidth} min={0} max={40} onChange={(strokeWidth) => onChange({ strokeWidth })} />
        </div>
      </Section>
      <Section title="Background box">
        <ColorInput value={layer.bgColor} allowNone onChange={(bgColor) => onChange({ bgColor })} />
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField label="Padding" value={layer.padding} min={0} onChange={(padding) => onChange({ padding })} />
          <NumberField label="Corner radius" value={layer.bgRadius} min={0} onChange={(bgRadius) => onChange({ bgRadius })} />
        </div>
        {layer.bgColor && <button type="button" className="text-[13px] text-muted hover:text-fg" onClick={() => onChange({ bgColor: '' })}>Remove box</button>}
      </Section>
    </>
  )
}

function ImageFields({ layer, onChange, onPick }: { layer: ImageLayer; onChange: (p: Partial<ImageLayer>) => void; onPick: () => void }) {
  return (
    <>
      <Section title="Image">
        <Select className="h-9" value={layer.source} onChange={(e) => onChange({ source: e.target.value as ImageLayer['source'] })}>
          <option value="slot">Photo slot (chosen per post)</option>
          <option value="logo">Page logo (from Settings)</option>
          <option value="media">Fixed image</option>
        </Select>
        {layer.source === 'slot' && (
          <Field label="Slot name" hint="Shown as a field when this template is used.">
            <Input className="h-8" value={layer.slot} onChange={(e) => onChange({ slot: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })} />
          </Field>
        )}
        {layer.source === 'media' && <Button size="sm" onClick={onPick}>{layer.mediaId ? 'Change image' : 'Choose image'}</Button>}
        <Select className="h-9" value={layer.fit} onChange={(e) => onChange({ fit: e.target.value as ImageLayer['fit'] })}>
          <option value="cover">Fill box (crop)</option>
          <option value="contain">Fit inside box</option>
        </Select>
      </Section>
      <Section title="Shape">
        <Toggle checked={layer.circle} onChange={(circle) => onChange({ circle })} label="Circle / oval" />
        {!layer.circle && <NumberField label="Corner radius" value={layer.radius} min={0} onChange={(radius) => onChange({ radius })} />}
        <div className="grid grid-cols-[1fr_80px] items-end gap-1.5">
          <Field label="Border"><ColorInput value={layer.borderColor} onChange={(borderColor) => onChange({ borderColor })} /></Field>
          <NumberField label="Width" value={layer.borderWidth} min={0} max={80} onChange={(borderWidth) => onChange({ borderWidth })} />
        </div>
      </Section>
    </>
  )
}

function ShapeFields({ layer, onChange }: { layer: ShapeLayer; onChange: (p: Partial<ShapeLayer>) => void }) {
  return (
    <Section title="Box">
      <Field label="Fill" hint="Supports rgba(), e.g. rgba(0,0,0,0.4) for a translucent panel.">
        <ColorInput value={layer.fill} onChange={(fill) => onChange({ fill })} />
      </Field>
      <NumberField label="Corner radius" value={layer.radius} min={0} onChange={(radius) => onChange({ radius })} />
      <div className="grid grid-cols-[1fr_80px] items-end gap-1.5">
        <Field label="Border"><ColorInput value={layer.strokeColor} onChange={(strokeColor) => onChange({ strokeColor })} /></Field>
        <NumberField label="Width" value={layer.strokeWidth} min={0} max={80} onChange={(strokeWidth) => onChange({ strokeWidth })} />
      </div>
    </Section>
  )
}
