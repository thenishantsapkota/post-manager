import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Bot, CalendarClock, ExternalLink, FileText, Pencil, RotateCcw, Send, Trash2 } from 'lucide-react'
import { Badge, Button, Card, EmptyState, PageHeader, StatusBadge, Tabs, mediaUrl, useAction, useConfirm } from '#/components/ui'
import { deletePostFn, listPostsFn, publishNowFn, unschedulePostFn } from '#/functions/posts.functions'
import { formatNpt, formatRelative } from '#/lib/time'
import type { PostStatus } from '#/lib/types'

const FILTERS = ['all', 'scheduled', 'draft', 'published', 'failed'] as const
type Filter = (typeof FILTERS)[number]

export const Route = createFileRoute('/_app/posts')({
  validateSearch: (s: Record<string, unknown>): { status?: Filter } =>
    FILTERS.includes(s.status as Filter) ? { status: s.status as Filter } : {},
  loaderDeps: ({ search }) => ({ status: search.status }),
  loader: ({ deps }) =>
    listPostsFn({ data: { status: deps.status && deps.status !== 'all' ? (deps.status as PostStatus) : undefined } }),
  component: PostsPage,
})

function PostsPage() {
  const confirm = useConfirm()
  const posts = Route.useLoaderData()
  const { status = 'all' } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const { busy, run } = useAction()

  // Keep "publishing" rows fresh without a manual reload.
  useEffect(() => {
    if (!posts.some((p) => p.status === 'publishing')) return
    const t = setInterval(() => router.invalidate(), 4000)
    return () => clearInterval(t)
  }, [posts, router])

  async function act(key: string, fn: () => Promise<unknown>, msg: string) {
    await run(key, fn, msg)
    await router.invalidate()
  }

  return (
    <>
      <PageHeader
        title="Posts"
        subtitle="Everything scheduled, drafted and published from this app."
        actions={<Link to="/compose"><Button variant="primary">New post</Button></Link>}
      />
      <div className="mb-4">
        <Tabs
          value={status}
          onChange={(v) => navigate({ search: v === 'all' ? {} : { status: v } })}
          items={FILTERS.map((f) => ({ value: f, label: f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1) }))}
        />
      </div>

      <Card>
        {posts.length === 0 ? (
          <EmptyState icon={<CalendarClock className="size-5" />} title="No posts here" body="Posts you create or automations generate will appear here." />
        ) : (
          <ul className="divide-y divide-border">
            {posts.map((p) => {
              const editable = p.status === 'draft' || p.status === 'scheduled' || p.status === 'failed'
              const when =
                p.status === 'published'
                  ? `Published ${formatNpt(p.publishedAt)}`
                  : p.status === 'scheduled'
                    ? `${formatNpt(p.scheduledAt)} · ${formatRelative(p.scheduledAt)}`
                    : p.status === 'draft'
                      ? `Edited ${formatRelative(p.updatedAt)}`
                      : formatRelative(p.updatedAt)
              return (
                <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {p.mediaIds[0] ? (
                      <img src={mediaUrl(p.mediaIds[0])} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted"><FileText className="size-5" /></div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold">{p.title || p.caption.slice(0, 80) || 'Untitled post'}</p>
                        <StatusBadge status={p.status} />
                        {p.source === 'automation' && <Badge tone="info"><Bot className="size-3" /> auto</Badge>}
                        {p.mediaIds.length > 1 && <Badge>{p.mediaIds.length} images</Badge>}
                      </div>
                      <p className="text-sm text-muted">{when}</p>
                      {p.error && <p className="mt-0.5 line-clamp-2 text-sm text-bad">{p.error}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {p.permalink && (
                      <a href={p.permalink} target="_blank" rel="noreferrer">
                        <Button size="sm" icon={<ExternalLink className="size-4" />}>View</Button>
                      </a>
                    )}
                    {editable && (
                      <Link to="/compose" search={{ id: p.id }}>
                        <Button size="sm" icon={<Pencil className="size-4" />}>Edit</Button>
                      </Link>
                    )}
                    {(p.status === 'scheduled' || p.status === 'draft') && (
                      <Button size="sm" icon={<Send className="size-4" />} loading={busy === `pub-${p.id}`} onClick={() => act(`pub-${p.id}`, () => publishNowFn({ data: { id: p.id } }), 'Publishing finished')}>
                        Post now
                      </Button>
                    )}
                    {p.status === 'failed' && (
                      <Button size="sm" variant="primary" icon={<RotateCcw className="size-4" />} loading={busy === `pub-${p.id}`} onClick={() => act(`pub-${p.id}`, () => publishNowFn({ data: { id: p.id } }), 'Retry finished')}>
                        Retry
                      </Button>
                    )}
                    {p.status === 'scheduled' && (
                      <Button size="sm" variant="ghost" onClick={() => act(`un-${p.id}`, () => unschedulePostFn({ data: { id: p.id } }), 'Moved to drafts')}>
                        Unschedule
                      </Button>
                    )}
                    {p.status !== 'publishing' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Delete"
                        icon={<Trash2 className="size-4" />}
                        onClick={async () => {
                          const ok = await confirm(
                            p.status === 'published'
                              ? { title: 'Remove this post from the app?', message: 'It stays on Facebook; only the record here is removed.', confirmLabel: 'Remove', tone: 'danger' }
                              : { title: 'Delete this post?', message: p.status === 'scheduled' ? 'It will not be published.' : undefined, confirmLabel: 'Delete', tone: 'danger' },
                          )
                          if (ok) act(`del-${p.id}`, () => deletePostFn({ data: { id: p.id } }), 'Deleted')
                        }}
                      />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}
