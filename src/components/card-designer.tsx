import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, RefreshCw } from 'lucide-react'
import { MediaPicker } from './media-picker'
import { Button, Field, Input, Modal, Select, Spinner, Textarea, cx, mediaUrl, useAction } from './ui'
import { previewCardFn, renderCardFn } from '#/functions/posts.functions'
import { listTemplatesFn } from '#/functions/templates.functions'
import { AUTO_VARS, templateFields } from '#/lib/template-vars'
import { THEME_KEYS } from '#/lib/types'
import type { CardSpec, ThemeKey } from '#/lib/types'
import type { Media, Template } from '#/server/db/schema'

const THEME_SWATCH: Record<ThemeKey, string> = {
  saffron: 'linear-gradient(135deg,#7c2d12,#f59e0b)',
  crimson: 'linear-gradient(135deg,#450a0a,#e11d48)',
  night: 'linear-gradient(135deg,#020617,#4338ca)',
  royal: 'linear-gradient(135deg,#2e1065,#c026d3)',
  forest: 'linear-gradient(135deg,#052e16,#65a30d)',
  ocean: 'linear-gradient(135deg,#082f49,#0891b2)',
}

export const EMPTY_CARD: CardSpec = { templateId: null, theme: 'saffron', vars: { title: '', body: '' }, slots: {} }

/**
 * Pick a template (or the built-in card), fill its fields, preview the exact
 * server render. `mode="spec"` returns the recipe (library items render it at
 * post time); `mode="media"` renders it to an image now.
 */
export function CardDesigner({
  open,
  initial,
  mode,
  onClose,
  onDone,
}: {
  open: boolean
  initial?: CardSpec | null
  mode: 'spec' | 'media'
  onClose: () => void
  onDone: (result: { spec: CardSpec; media?: Media }) => void
}) {
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [spec, setSpec] = useState<CardSpec>(initial ?? EMPTY_CARD)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [slotPicker, setSlotPicker] = useState<string | null>(null)
  const { busy, run } = useAction()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!open) return
    setSpec(initial ?? EMPTY_CARD)
    setPreview(null)
    listTemplatesFn().then((rows) => setTemplates(rows.filter((t) => t.kind === 'general')))
  }, [open, initial])

  const template = templates?.find((t) => t.id === spec.templateId) ?? null
  const fields = useMemo(() => (template ? templateFields(template) : { vars: ['title', 'body'], slots: [] }), [template])

  // Debounced exact preview from the server renderer.
  useEffect(() => {
    if (!open) return
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setPreviewing(true)
      try {
        setPreview((await previewCardFn({ data: { spec } })).dataUrl)
      } catch {
        setPreview(null)
      } finally {
        setPreviewing(false)
      }
    }, 450)
    return () => clearTimeout(timer.current)
  }, [spec, open])

  const setVar = (k: string, v: string) => setSpec((s) => ({ ...s, vars: { ...s.vars, [k]: v } }))

  async function done() {
    if (mode === 'spec') {
      onDone({ spec })
      onClose()
      return
    }
    const media = await run('render', () => renderCardFn({ data: { spec, label: template?.name ?? 'Text card' } }))
    if (media) {
      onDone({ spec, media })
      onClose()
    }
  }

  const missingSlot = fields.slots.find((s) => !spec.slots[s])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Design a card"
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy === 'render'} onClick={done} disabled={!!missingSlot}>
            {mode === 'media' ? 'Create image' : 'Use this design'}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Field
            label="Design"
            hint={
              <>
                Upload your own designs under <Link to="/templates" className="font-semibold text-accent">Templates</Link>.
              </>
            }
          >
            <Select
              value={spec.templateId ?? ''}
              onChange={(e) => {
                const id = e.target.value || null
                setSpec((s) => ({ ...s, templateId: id, slots: {} }))
              }}
            >
              <option value="">Built-in text card</option>
              {templates?.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>

          {!spec.templateId && (
            <div>
              <p className="mb-1.5 text-sm font-semibold">Colour theme</p>
              <div className="flex flex-wrap gap-2">
                {THEME_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSpec((s) => ({ ...s, theme: k }))}
                    className={cx('size-9 rounded-full border-2', spec.theme === k ? 'border-fg' : 'border-transparent')}
                    style={{ background: THEME_SWATCH[k] }}
                    aria-label={k}
                    title={k}
                  />
                ))}
              </div>
            </div>
          )}

          {fields.vars.map((k) => (
            <Field key={k} label={k === 'body' ? 'Text' : k.replace(/_/g, ' ')}>
              {k === 'body' || (spec.vars[k]?.length ?? 0) > 60 ? (
                <Textarea rows={4} value={spec.vars[k] ?? ''} onChange={(e) => setVar(k, e.target.value)} />
              ) : (
                <Input value={spec.vars[k] ?? ''} onChange={(e) => setVar(k, e.target.value)} />
              )}
            </Field>
          ))}

          {fields.slots.map((slot) => (
            <div key={slot}>
              <p className="mb-1.5 text-sm font-semibold capitalize">{slot.replace(/_/g, ' ')} image</p>
              <button
                type="button"
                onClick={() => setSlotPicker(slot)}
                className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-2 text-left hover:bg-surface-2"
              >
                {spec.slots[slot] ? (
                  <img src={mediaUrl(spec.slots[slot])} alt="" className="size-14 rounded-md object-cover" />
                ) : (
                  <div className="grid size-14 place-items-center rounded-md bg-surface-2 text-muted"><ImagePlus className="size-5" /></div>
                )}
                <span className="text-sm text-muted">{spec.slots[slot] ? 'Change image' : 'Choose an image'}</span>
              </button>
            </div>
          ))}

          <p className="text-[13px] text-muted">
            Auto-filled: {AUTO_VARS.map((v) => `{${v.key}}`).join(' ')} — dates are filled in when the post is made.
          </p>
        </div>

        <div>
          <div className="checker relative grid aspect-[4/5] place-items-center overflow-hidden rounded-xl">
            {preview ? <img src={preview} alt="Preview" className="size-full object-contain" /> : <Spinner />}
            {previewing && preview && (
              <span className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"><RefreshCw className="size-3.5 animate-spin" /></span>
            )}
          </div>
          <p className="mt-2 text-center text-[13px] text-muted">Exact render from the server</p>
        </div>
      </div>

      <MediaPicker
        open={!!slotPicker}
        onClose={() => setSlotPicker(null)}
        onPick={(m) => slotPicker && setSpec((s) => ({ ...s, slots: { ...s.slots, [slotPicker]: m[0].id } }))}
        title="Choose an image for this slot"
      />
    </Modal>
  )
}
