import { useEffect, useRef, useState } from 'react'
import { Check, ImagePlus, Upload } from 'lucide-react'
import { Button, Modal, Spinner, Tabs, cx, mediaUrl, useToast } from './ui'
import { listMediaFn, uploadMediaFn } from '#/functions/media.functions'
import type { Media } from '#/server/db/schema'

export async function uploadFiles(files: FileList | File[]): Promise<Media[]> {
  const out: Media[] = []
  for (const file of Array.from(files)) {
    const form = new FormData()
    form.set('file', file)
    form.set('label', file.name)
    out.push(await uploadMediaFn({ data: form }))
  }
  return out
}

/** Hidden file input + button that uploads and returns media rows. */
export function UploadButton({
  onUploaded,
  multiple = true,
  label = 'Upload',
  variant = 'secondary',
}: {
  onUploaded: (media: Media[]) => void
  multiple?: boolean
  label?: string
  variant?: 'primary' | 'secondary'
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple={multiple}
        className="hidden"
        onChange={async (e) => {
          const files = e.target.files
          if (!files?.length) return
          setBusy(true)
          try {
            onUploaded(await uploadFiles(files))
          } catch (err) {
            toast.error(err)
          } finally {
            setBusy(false)
            e.target.value = ''
          }
        }}
      />
      <Button variant={variant} loading={busy} icon={<Upload className="size-4" />} onClick={() => input.current?.click()}>
        {label}
      </Button>
    </>
  )
}

export function MediaPicker({
  open,
  onClose,
  onPick,
  multiple = false,
  title = 'Choose images',
}: {
  open: boolean
  onClose: () => void
  onPick: (media: Media[]) => void
  multiple?: boolean
  title?: string
}) {
  const [kind, setKind] = useState<'upload' | 'generated'>('upload')
  const [items, setItems] = useState<Media[] | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    setItems(null)
    listMediaFn({ data: { kind, limit: 200 } }).then(setItems, (err) => toast.error(err))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind])

  useEffect(() => {
    if (open) setSelected([])
  }, [open])

  function toggle(id: string) {
    if (!multiple) {
      const m = items?.find((i) => i.id === id)
      if (m) {
        onPick([m])
        onClose()
      }
      return
    }
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        multiple && (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              disabled={selected.length === 0}
              onClick={() => {
                onPick(selected.map((id) => items!.find((i) => i.id === id)!).filter(Boolean))
                onClose()
              }}
            >
              Add {selected.length || ''} image{selected.length === 1 ? '' : 's'}
            </Button>
          </>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={kind}
          onChange={setKind}
          items={[
            { value: 'upload', label: 'Uploads' },
            { value: 'generated', label: 'Generated' },
          ]}
        />
        <UploadButton
          multiple={multiple}
          onUploaded={(m) => {
            if (!multiple) {
              onPick(m.slice(0, 1))
              onClose()
              return
            }
            setKind('upload')
            setItems((prev) => [...m, ...(prev ?? [])])
            setSelected((s) => [...s, ...m.map((x) => x.id)])
          }}
        />
      </div>
      {items === null ? (
        <div className="grid place-items-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center text-muted">
          <ImagePlus className="mb-2 size-8" />
          <p>No images yet. Upload one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {items.map((m) => {
            const idx = selected.indexOf(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className={cx(
                  'group relative aspect-square overflow-hidden rounded-lg border-2 bg-surface-2',
                  idx >= 0 ? 'border-accent' : 'border-transparent hover:border-border',
                )}
                title={m.label ?? ''}
              >
                <img src={mediaUrl(m.id)} alt={m.label ?? ''} loading="lazy" className="size-full object-cover" />
                {idx >= 0 && (
                  <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-accent text-xs font-bold text-accent-fg">
                    {multiple ? idx + 1 : <Check className="size-3.5" />}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
