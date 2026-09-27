import { Link, createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, Bot, CalendarClock, CheckCircle2, CircleAlert, Info, PenSquare, Sparkles } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, cx, mediaUrl } from '#/components/ui'
import { getDashboardFn } from '#/functions/settings.functions'
import { formatNpt, formatRelative } from '#/lib/time'

export const Route = createFileRoute('/_app/')({
  loader: () => getDashboardFn(),
  component: Dashboard,
})

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'bad' }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={cx('mt-1 text-3xl font-extrabold tabular-nums', tone === 'bad' && value > 0 && 'text-bad')}>{value}</p>
    </Card>
  )
}

function Dashboard() {
  const d = Route.useLoaderData()

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={d.connected ? `Posting to ${d.pageName}` : 'Connect your Facebook page to start posting.'}
        actions={
          <Link to="/compose">
            <Button variant="primary" icon={<PenSquare className="size-4" />}>New post</Button>
          </Link>
        }
      />

      {!d.connected && (
        <Card className="mb-6 border-warn/40 bg-warn-soft/40">
          <div className="flex flex-wrap items-center gap-4 px-5 py-4">
            <AlertTriangle className="size-6 shrink-0 text-warn" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Facebook page not connected</p>
              <p className="text-sm text-muted">Scheduled posts can't publish until you add a Page access token.</p>
            </div>
            <Link to="/settings"><Button variant="primary">Connect page</Button></Link>
          </div>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Published (7 days)" value={d.stats.publishedWeek} />
        <Stat label="Scheduled" value={d.stats.scheduled} />
        <Stat label="Failed" value={d.stats.failed} tone="bad" />
        <Stat label="Active automations" value={d.stats.activeAutomations} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader
              title="Up next"
              action={<Link to="/posts" className="text-sm font-semibold text-accent">All posts</Link>}
            />
            {d.upcoming.length === 0 ? (
              <EmptyState icon={<CalendarClock className="size-5" />} title="Nothing scheduled" body="Compose a post or set up an automation." />
            ) : (
              <ul className="divide-y divide-border">
                {d.upcoming.map((p) => (
                  <li key={p.id}>
                    <Link to="/compose" search={{ id: p.id }} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/60">
                      {p.mediaIds[0] ? (
                        <img src={mediaUrl(p.mediaIds[0])} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="size-12 shrink-0 rounded-lg bg-surface-2" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{p.title || p.caption || 'Untitled post'}</p>
                        <p className="text-sm text-muted">
                          {formatNpt(p.scheduledAt)} · {formatRelative(p.scheduledAt)}
                          {p.mediaIds.length > 1 && ` · ${p.mediaIds.length} images`}
                        </p>
                      </div>
                      {p.source === 'automation' && <Badge tone="info"><Bot className="size-3" /> auto</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Automations" action={<Link to="/automations" className="text-sm font-semibold text-accent">Manage</Link>} />
            {d.automations.length === 0 ? (
              <EmptyState
                icon={<Bot className="size-5" />}
                title="No automations yet"
                body="Post the daily rashifal automatically every morning."
                action={<Link to="/automations"><Button>Create automation</Button></Link>}
              />
            ) : (
              <ul className="divide-y divide-border">
                {d.automations.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{a.name}</p>
                      <p className="text-sm text-muted">Next: {formatNpt(a.nextRunAt)}</p>
                    </div>
                    {a.lastStatus === 'error' && <Badge tone="bad">last run failed</Badge>}
                    {a.lastStatus === 'ok' && <Badge tone="ok">ok</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <Sparkles className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">आजको राशिफल</p>
                <p className="text-sm text-muted">
                  {d.todayRashifal ? 'Available from Nepali Patro' : "Today's set isn't published yet"}
                </p>
              </div>
              <Link to="/rashifal"><Button size="sm" icon={<ArrowRight className="size-4" />}>Open</Button></Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            {d.activity.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.activity.map((a) => (
                  <li key={a.id} className="flex gap-3 px-5 py-2.5">
                    {a.level === 'success' ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />
                    ) : a.level === 'error' ? (
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-bad" />
                    ) : (
                      <Info className="mt-0.5 size-4 shrink-0 text-muted" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm leading-snug">{a.message}</p>
                      <p className="text-xs text-muted">{formatRelative(a.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {!d.schedulerEnabled && (
            <p className="text-sm text-warn">The in-process scheduler is disabled (SCHEDULER_ENABLED=false). Make sure an external cron calls /api/cron.</p>
          )}
        </div>
      </div>
    </>
  )
}
