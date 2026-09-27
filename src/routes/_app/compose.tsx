import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Crop, ImagePlus, Palette, Trash2 } from 'lucide-react'
import { CardDesigner } from '#/components/card-designer'
import { FacebookPreview } from '#/components/fb-preview'
import { ImageEditor } from '#/components/image-editor'
import { MediaPicker, UploadButton } from '#/components/media-picker'
import { SchedulePicker, defaultSchedule, scheduleEpoch } from '#/components/schedule-picker'
import type { ScheduleValue } from '#/components/schedule-picker'
import { Button, Card, CardHeader, Field, Input, PageHeader, StatusBadge, Textarea, mediaUrl, useAction } from '#/components/ui'
import { getPostFn, savePostFn } from '#/functions/posts.functions'
import { getSettingsFn } from '#/functions/settings.functions'
import type { Media } from '#/server/db/schema'

export const Route = createFileRoute('/_app/compose')({
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s.id === 'string' ? { id: s.id } : {}),
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: async ({ deps }) => ({
    settings: await getSettingsFn(),
    existing: deps.id ? await getPostFn({ data: { id: deps.id } }) : null,
  }),
  component: ComposePage,
})

const FB_LIMIT = 63206

function ComposePage() {
  const { settings, existing } = Route.useLoaderData()
  const navigate = useNavigate()
  const post = existing?.post
  const locked = post?.status === 'published' || post?.status === 'publishing'

  const [title, setTitle] = useState(post?.title ?? '')
  const [caption, setCaption] = useState(post?.caption ?? '')
  const [media, setMedia] = useState<Media[]>(existing?.media ?? [])
  const [schedule, setSchedule] = useState<ScheduleValue>(() =>
    defaultSchedule(post?.status === 'scheduled' || post?.status === 'failed' ? post.scheduledAt : null),
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [designerOpen, setDesignerOpen] = useState(false)
  const [editing, setEditing] = useState<{ media: Media; index: number } | null>(null)
  const { busy, run } = useAction()

  useEffect(() => {
    if (post?.status === 'draft') setSchedule((s) => ({ ...s, mode: 'draft' }))
  }, [post?.status])

  const addMedia = (m: Media[]) => setMedia((cur) => [...cur, ...m].slice(0, 30))
  const move = (i: number, d: -1 | 1) =>
    setMedia((cur) => {
      const next = [...cur]
      const j = i + d
      if (j < 0 || j >= next.length) return cur
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  async function submit() {
    const res = await run(
      'save',
      () =>
        savePostFn({
          data: {
            id: post?.id,
            title: title || undefined,
            caption,
            mediaIds: media.map((m) => m.id),
            mode: schedule.mode,
            scheduledAt: schedule.mode === 'schedule' ? scheduleEpoch(schedule) : undefined,
          },
        }),
    )
    if (!res) return
    if (res.status === 'failed') {
      // Publishing ran but Facebook rejected it; stay so the user can see why.
      await navigate({ to: '/posts', search: { status: 'failed' } })
      return
    }
    await navigate({ to: '/posts', search: { status: res.status === 'published' ? 'published' : res.status === 'draft' ? 'draft' : 'scheduled' } })
  }

  const actionLabel = schedule.mode === 'now' ? 'Publish now' : schedule.mode === 'schedule' ? 'Schedule post' : 'Save draft'

  return (
    <>
      <PageHeader
        title={post ? 'Edit post' : 'Compose'}
        subtitle={post ? <span className="inline-flex items-center gap-2">Status: <StatusBadge status={post.status} /></span> : 'Write a caption, add images, and publish or schedule.'}
      />
      {post?.error && <p className="mb-4 rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">Last error: {post.error}</p>}
      {locked && <p className="mb-4 rounded-lg bg-info-soft px-4 py-3 text-sm text-info">This post is already on Facebook and can't be edited here.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <div className="space-y-4 p-5">
              <Field label="Internal title" hint="Only shown in this app, not on Facebook.">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dashain wishes" disabled={locked} />
              </Field>
              <Field label="Caption" hint={`${caption.length.toLocaleString()} / ${FB_LIMIT.toLocaleString()} characters`}>
                <Textarea rows={9} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="के लेख्ने? Write something…" maxLength={FB_LIMIT} disabled={locked} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Images"
              subtitle="Several images become one album post. Drag order with the arrows."
              action={
                !locked && (
                  <div className="flex flex-wrap gap-2">
                    <UploadButton onUploaded={addMedia} />
                    <Button icon={<ImagePlus className="size-4" />} onClick={() => setPickerOpen(true)}>Library</Button>
                    <Button icon={<Palette className="size-4" />} onClick={() => setDesignerOpen(true)}>Design</Button>
                  </div>
                )
              }
            />
            <div className="p-5">
              {media.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">No images. Text-only posts are fine too.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {media.map((m, i) => (
                    <div key={`${m.id}-${i}`} className="group relative overflow-hidden rounded-lg border border-border bg-surface-2">
                      <img src={mediaUrl(m.id)} alt="" className="aspect-square w-full object-cover" />
                      <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-xs font-bold text-white">{i + 1}</span>
                      {!locked && (
                        <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-6">
                          <div className="flex gap-1">
                            <IconBtn label="Move left" onClick={() => move(i, -1)}><ArrowLeft className="size-3.5" /></IconBtn>
                            <IconBtn label="Move right" onClick={() => move(i, 1)}><ArrowRight className="size-3.5" /></IconBtn>
                          </div>
                          <div className="flex gap-1">
                            <IconBtn label="Edit image" onClick={() => setEditing({ media: m, index: i })}><Crop className="size-3.5" /></IconBtn>
                            <IconBtn label="Remove" onClick={() => setMedia((cur) => cur.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></IconBtn>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {!locked && (
            <Card>
              <CardHeader title="Publish" />
              <div className="space-y-4 p-5">
                <SchedulePicker value={schedule} onChange={setSchedule} />
                {!settings.hasToken && schedule.mode !== 'draft' && (
                  <p className="text-sm text-warn">No Facebook page connected yet. Connect it in Settings first.</p>
                )}
                <Button variant="primary" className="w-full" loading={busy === 'save'} onClick={submit}>
                  {actionLabel}
                </Button>
              </div>
            </Card>
          )}
          <div>
            <p className="mb-2 text-sm font-semibold text-muted">Preview</p>
            <FacebookPreview pageName={settings.fbPageName || settings.brandName} logoMediaId={settings.logoMediaId} caption={caption} mediaIds={media.map((m) => m.id)} />
          </div>
        </div>
      </div>

      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addMedia} multiple />
      <CardDesigner open={designerOpen} mode="media" onClose={() => setDesignerOpen(false)} onDone={({ media: m }) => m && addMedia([m])} />
      <ImageEditor
        media={editing?.media ?? null}
        logoMediaId={settings.logoMediaId}
        onClose={() => setEditing(null)}
        onSaved={(m) => editing && setMedia((cur) => cur.map((x, j) => (j === editing.index ? m : x)))}
      />
    </>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-7 place-items-center rounded-md bg-white/90 text-stone-900 hover:bg-white">
      {children}
    </button>
  )
}
