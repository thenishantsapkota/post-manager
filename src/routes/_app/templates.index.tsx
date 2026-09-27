import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Copy, ImagePlus, Palette, Plus, Trash2 } from 'lucide-react'
import { uploadFiles } from '#/components/media-picker'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, cx, mediaUrl, useAction } from '#/components/ui'
import { deleteTemplateFn, duplicateTemplateFn, listTemplatesFn, saveTemplateFn } from '#/functions/templates.functions'
import { KIND_LABELS, SIZE_PRESETS, starterLayers } from '#/lib/template-presets'
import type { TemplateKind } from '#/lib/types'
import type { Media } from '#/server/db/schema'

export const Route = createFileRoute('/_app/templates/')({
  loader: () => listTemplatesFn(),
  component: TemplatesPage,
})

function TemplatesPage() {
  const templates = Route.useLoaderData()
  const router = useRouter()
  const { busy, run } = useAction()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader
        title="Templates"
        subtitle="Upload your own designs and place text and photo layers on them. Use them for rashifal images and any other post."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New template</Button>}
      />

      {templates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Palette className="size-5" />}
            title="No templates yet"
            body="Upload a background design (from Canva, Photoshop, etc.), then add text layers like {sign_np} and {rashifal} where the words should go."
            action={<Button variant="primary" onClick={() => setCreating(true)}>Create your first template</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {templates.map((t) => (
            <Card key={t.id} className="group overflow-hidden">
              <Link to="/templates/$id" params={{ id: t.id }} className="block">
                <div className="checker relative overflow-hidden" style={{ aspectRatio: `${t.width} / ${t.height}` }}>
                  {t.backgroundMediaId ? (
                    <img src={mediaUrl(t.backgroundMediaId)} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full" style={{ background: t.backgroundColor }} />
                  )}
                  <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white">
                    {t.layers.length} layer{t.layers.length === 1 ? '' : 's'}
                  </span>
                </div>
              </Link>
              <div className="space-y-1.5 p-3">
                <p className="truncate font-bold">{t.name}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={t.kind === 'general' ? 'neutral' : 'accent'}>{KIND_LABELS[t.kind]}</Badge>
                  {t.isRashifalDefault && <Badge tone="ok">in use</Badge>}
                </div>
                <div className="flex gap-1 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Copy className="size-4" />}
                    loading={busy === `dup-${t.id}`}
                    onClick={async () => {
                      await run(`dup-${t.id}`, () => duplicateTemplateFn({ data: { id: t.id } }), 'Duplicated')
                      await router.invalidate()
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="size-4" />}
                    onClick={async () => {
                      if (!confirm(`Delete “${t.name}”?`)) return
                      await run(`del-${t.id}`, () => deleteTemplateFn({ data: { id: t.id } }), 'Template deleted')
                      await router.invalidate()
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewTemplateModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

function NewTemplateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { busy, run } = useAction()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<TemplateKind>('rashifal_sign')
  const [bg, setBg] = useState<Media | null>(null)
  const [size, setSize] = useState('bg')

  const dims = (() => {
    if (size === 'bg' && bg?.width && bg.height) return { w: bg.width, h: bg.height }
    const p = SIZE_PRESETS[Number(size)] ?? SIZE_PRESETS[0]
    return { w: p.w, h: p.h }
  })()
  // Very large uploads are scaled to a workable canvas; the background still fills it.
  const scale = Math.min(1, 2400 / Math.max(dims.w, dims.h))
  const w = Math.round(dims.w * scale)
  const h = Math.round(dims.h * scale)

  async function create() {
    const res = await run('create', () =>
      saveTemplateFn({
        data: {
          id: null,
          data: {
            name: name.trim() || KIND_LABELS[kind],
            kind,
            width: w,
            height: h,
            backgroundMediaId: bg?.id ?? null,
            backgroundColor: '#7c2d12',
            signBackgrounds: {},
            layers: starterLayers(kind, w, h, Boolean(bg)),
          },
        },
      }),
    )
    if (res) {
      onClose()
      await router.navigate({ to: '/templates/$id', params: { id: res.id } })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New template"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy === 'create'} onClick={create}>Create & edit</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rashifal — golden frame" autoFocus />
        </Field>
        <Field label="Used for">
          <Select value={kind} onChange={(e) => setKind(e.target.value as TemplateKind)}>
            {(Object.keys(KIND_LABELS) as TemplateKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </Select>
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Background design</p>
          <label className={cx('flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-3 hover:bg-surface-2', busy === 'upload' && 'opacity-60')}>
            {bg ? <img src={mediaUrl(bg.id)} alt="" className="size-16 rounded-md object-cover" /> : <div className="grid size-16 place-items-center rounded-md bg-surface-2 text-muted"><ImagePlus className="size-6" /></div>}
            <span className="text-sm text-muted">{bg ? `${bg.width}×${bg.height}px — click to change` : 'Upload your PNG/JPG design (optional — you can add it later)'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const m = await run('upload', () => uploadFiles([f]))
                if (m?.[0]) {
                  setBg(m[0])
                  setSize('bg')
                }
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <Field label="Canvas size">
          <Select value={size} onChange={(e) => setSize(e.target.value)}>
            {bg && <option value="bg">Match background ({bg.width}×{bg.height})</option>}
            {SIZE_PRESETS.map((p, i) => <option key={p.label} value={String(i)}>{p.label}</option>)}
          </Select>
        </Field>
        <p className="text-[13px] text-muted">Starter text layers are added for you; move them onto your design in the editor.</p>
      </div>
    </Modal>
  )
}
