import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Crop, Images, Trash2 } from 'lucide-react'
import { ImageEditor } from '#/components/image-editor'
import { UploadButton } from '#/components/media-picker'
import { Button, Card, EmptyState, PageHeader, Tabs, mediaUrl, useAction } from '#/components/ui'
import { deleteMediaFn, listMediaFn } from '#/functions/media.functions'
import { getSettingsFn } from '#/functions/settings.functions'
import { formatNpt } from '#/lib/time'
import type { Media } from '#/server/db/schema'

type Kind = 'upload' | 'generated'

export const Route = createFileRoute('/_app/media')({
  validateSearch: (s: Record<string, unknown>): { kind?: Kind } => (s.kind === 'generated' ? { kind: 'generated' } : {}),
  loaderDeps: ({ search }) => ({ kind: search.kind ?? 'upload' }),
  loader: async ({ deps }) => ({
    media: await listMediaFn({ data: { kind: deps.kind, limit: 300 } }),
    settings: await getSettingsFn(),
  }),
  component: MediaPage,
})

function formatBytes(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
}

function MediaPage() {
  const { media, settings } = Route.useLoaderData()
  const { kind = 'upload' } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const [editing, setEditing] = useState<Media | null>(null)
  const { run } = useAction()

  return (
    <>
      <PageHeader
        title="Media"
        subtitle="Your uploaded photos and the images this app has generated. Editing always saves a new copy."
        actions={<UploadButton variant="primary" label="Upload images" onUploaded={() => router.invalidate()} />}
      />
      <div className="mb-4">
        <Tabs
          value={kind}
          onChange={(k) => navigate({ search: k === 'upload' ? {} : { kind: k } })}
          items={[
            { value: 'upload', label: 'Uploads' },
            { value: 'generated', label: 'Generated' },
          ]}
        />
      </div>
      {media.length === 0 ? (
        <Card>
          <EmptyState icon={<Images className="size-5" />} title="No images" body={kind === 'upload' ? 'Upload photos to use in posts and templates.' : 'Rashifal and card images appear here once generated.'} />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {media.map((m) => (
            <Card key={m.id} className="group overflow-hidden">
              <a href={mediaUrl(m.id)} target="_blank" rel="noreferrer" className="block bg-surface-2">
                <img src={mediaUrl(m.id)} alt={m.label ?? ''} loading="lazy" className="aspect-square w-full object-cover" />
              </a>
              <div className="p-2.5">
                <p className="truncate text-sm font-semibold" title={m.label ?? ''}>{m.label || 'Untitled'}</p>
                <p className="text-[12px] text-muted">{m.width}×{m.height} · {formatBytes(m.bytes)}</p>
                <p className="text-[12px] text-muted">{formatNpt(m.createdAt)}</p>
                <div className="mt-2 flex gap-1">
                  <Button size="sm" icon={<Crop className="size-3.5" />} onClick={() => setEditing(m)}>Edit</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Delete"
                    icon={<Trash2 className="size-3.5" />}
                    onClick={async () => {
                      if (!confirm('Delete this image? Posts and templates that use it will lose it.')) return
                      await run('del', () => deleteMediaFn({ data: { id: m.id } }), 'Image deleted')
                      await router.invalidate()
                    }}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ImageEditor media={editing} logoMediaId={settings.logoMediaId} onClose={() => setEditing(null)} onSaved={() => router.invalidate()} />
    </>
  )
}
