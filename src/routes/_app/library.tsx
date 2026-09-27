import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ImagePlus, Library, Palette, Pencil, Plus, Trash2 } from 'lucide-react'
import { CardDesigner } from '#/components/card-designer'
import { MediaPicker } from '#/components/media-picker'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, PageHeader, Textarea, Toggle, mediaUrl, useAction, useConfirm } from '#/components/ui'
import { deleteLibraryItemFn, listLibraryFn, saveLibraryItemFn } from '#/functions/library.functions'
import { formatRelative } from '#/lib/time'
import type { CardSpec } from '#/lib/types'
import type { LibraryItem } from '#/server/db/schema'

export const Route = createFileRoute('/_app/library')({
  loader: () => listLibraryFn(),
  component: LibraryPage,
})

type Draft = {
  id: string | null
  collection: string
  caption: string
  mediaId: string | null
  card: CardSpec | null
  active: boolean
}

function LibraryPage() {
  const confirm = useConfirm()
  const items = Route.useLoaderData()
  const router = useRouter()
  const { run } = useAction()
  const [draft, setDraft] = useState<Draft | null>(null)

  const groups = useMemo(() => {
    const map = new Map<string, LibraryItem[]>()
    for (const it of items) map.set(it.collection, [...(map.get(it.collection) ?? []), it])
    return [...map.entries()]
  }, [items])

  const newDraft = (collection = ''): Draft => ({ id: null, collection, caption: '', mediaId: null, card: null, active: true })

  return (
    <>
      <PageHeader
        title="Content library"
        subtitle="Collections of ready-made posts (quotes, greetings, tips). An automation can post one per day in order or at random."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setDraft(newDraft())}>Add item</Button>}
      />

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Library className="size-5" />}
            title="Library is empty"
            body="Create a collection such as “Good morning” and add posts to it. Then set up an automation to post from it."
            action={<Button variant="primary" onClick={() => setDraft(newDraft('Good morning'))}>Add first item</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([collection, list]) => (
            <Card key={collection}>
              <CardHeader
                title={collection}
                subtitle={`${list.length} item${list.length === 1 ? '' : 's'} · ${list.filter((i) => i.active).length} active`}
                action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setDraft(newDraft(collection))}>Add</Button>}
              />
              <ul className="divide-y divide-border">
                {list.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 px-5 py-3">
                    {it.mediaId ? (
                      <img src={mediaUrl(it.mediaId)} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                    ) : it.card ? (
                      <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Palette className="size-5" /></div>
                    ) : (
                      <div className="size-14 shrink-0 rounded-lg bg-surface-2" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[15px]">{it.caption || it.card?.vars.body || it.card?.vars.title || <span className="text-muted">No caption</span>}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {!it.active && <Badge>paused</Badge>}
                        {it.card && <Badge tone="accent">designed card</Badge>}
                        <Badge>posted {it.timesPosted}×</Badge>
                        {it.lastPostedAt && <Badge>last {formatRelative(it.lastPostedAt)}</Badge>}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} aria-label="Edit" onClick={() => setDraft({ ...it })} />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 className="size-4" />}
                      aria-label="Delete"
                      onClick={async () => {
                        if (!(await confirm({ title: 'Delete this library item?', message: 'Automations will stop posting it.', confirmLabel: 'Delete', tone: 'danger' }))) return
                        await run('del', () => deleteLibraryItemFn({ data: { id: it.id } }), 'Deleted')
                        await router.invalidate()
                      }}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <ItemModal
        draft={draft}
        collections={groups.map(([c]) => c)}
        onClose={() => setDraft(null)}
        onSaved={async () => {
          setDraft(null)
          await router.invalidate()
        }}
      />
    </>
  )
}

function ItemModal({ draft, collections, onClose, onSaved }: { draft: Draft | null; collections: string[]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft | null>(draft)
  const [picker, setPicker] = useState(false)
  const [designer, setDesigner] = useState(false)
  const { busy, run } = useAction()
  const [prev, setPrev] = useState(draft)
  if (draft !== prev) {
    setPrev(draft)
    setD(draft)
  }
  if (!d) return null

  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      title={d.id ? 'Edit library item' : 'Add library item'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy === 'save'}
            onClick={async () => {
              const ok = await run('save', () => saveLibraryItemFn({ data: d }), 'Saved')
              if (ok) onSaved()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Collection">
          <Input list="collections" value={d.collection} onChange={(e) => setD({ ...d, collection: e.target.value })} placeholder="e.g. Good morning" />
          <datalist id="collections">{collections.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Caption">
          <Textarea rows={5} value={d.caption} onChange={(e) => setD({ ...d, caption: e.target.value })} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Image</p>
          {d.card ? (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="grid size-12 place-items-center rounded-md bg-accent-soft text-accent"><Palette className="size-5" /></div>
              <p className="flex-1 text-sm text-muted">Designed card. It's rendered fresh when posted, so dates stay current.</p>
              <Button size="sm" onClick={() => setDesigner(true)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => setD({ ...d, card: null })}>Remove</Button>
            </div>
          ) : d.mediaId ? (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <img src={mediaUrl(d.mediaId)} alt="" className="size-12 rounded-md object-cover" />
              <div className="flex-1" />
              <Button size="sm" onClick={() => setPicker(true)}>Change</Button>
              <Button size="sm" variant="ghost" onClick={() => setD({ ...d, mediaId: null })}>Remove</Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button icon={<ImagePlus className="size-4" />} onClick={() => setPicker(true)}>Choose image</Button>
              <Button icon={<Palette className="size-4" />} onClick={() => setDesigner(true)}>Design a card</Button>
            </div>
          )}
        </div>
        <Toggle checked={d.active} onChange={(active) => setD({ ...d, active })} label="Active (included in automations)" />
      </div>
      <MediaPicker open={picker} onClose={() => setPicker(false)} onPick={(m) => setD({ ...d, mediaId: m[0].id, card: null })} />
      <CardDesigner open={designer} mode="spec" initial={d.card} onClose={() => setDesigner(false)} onDone={({ spec }) => setD({ ...d, card: spec, mediaId: null })} />
    </Modal>
  )
}
