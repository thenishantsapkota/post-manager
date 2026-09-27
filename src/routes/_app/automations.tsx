import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Bot, CloudSun, Pencil, Play, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Toggle, cx, useAction, useConfirm } from '#/components/ui'
import {
  deleteAutomationFn,
  listAutomationsFn,
  previewScheduleFn,
  runAutomationNowFn,
  saveAutomationFn,
  toggleAutomationFn,
} from '#/functions/automations.functions'
import { formatNpt, formatRelative } from '#/lib/time'
import { PERIOD_LABELS, RASHIFAL_PERIODS } from '#/lib/types'
import type { AutomationConfig, RashifalPeriod } from '#/lib/types'
import { SLOT_INFO, WEATHER_SLOTS } from '#/lib/weather'
import type { WeatherSlot } from '#/lib/weather'
import type { Automation } from '#/server/db/schema'

export const Route = createFileRoute('/_app/automations')({
  loader: () => listAutomationsFn(),
  component: AutomationsPage,
})

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type ScheduleUI =
  | { mode: 'daily'; time: string }
  | { mode: 'weekly'; time: string; days: number[] }
  | { mode: 'custom'; cron: string }

function toCron(s: ScheduleUI) {
  if (s.mode === 'custom') return s.cron.trim()
  const [h, m] = s.time.split(':').map(Number)
  return s.mode === 'daily' ? `${m} ${h} * * *` : `${m} ${h} * * ${[...s.days].sort().join(',') || '0'}`
}

function fromCron(cron: string): ScheduleUI {
  const m = cron.trim().match(/^(\d{1,2}) (\d{1,2}) \* \* (\*|[0-6](?:,[0-6])*)$/)
  if (!m) return { mode: 'custom', cron }
  const time = `${m[2].padStart(2, '0')}:${m[1].padStart(2, '0')}`
  return m[3] === '*' ? { mode: 'daily', time } : { mode: 'weekly', time, days: m[3].split(',').map(Number) }
}

function describe(cron: string) {
  const s = fromCron(cron)
  const t = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  }
  if (s.mode === 'daily') return `Every day at ${t(s.time)}`
  if (s.mode === 'weekly') return `${s.days.map((d) => DAYS[d]).join(', ')} at ${t(s.time)}`
  return `Cron: ${cron}`
}

function describeConfig(c: AutomationConfig) {
  if (c.kind === 'rashifal') return `${PERIOD_LABELS[c.period]} rashifal · ${c.period === 'Y' || c.format === 'cover' ? 'cover + caption' : 'album of 13 images'}`
  if (c.kind === 'weather') return `${SLOT_INFO[c.slot].en} weather for Damak`
  return `From “${c.collection}” · ${c.order}`
}

interface Draft {
  id: string | null
  name: string
  enabled: boolean
  schedule: ScheduleUI
  config: AutomationConfig
}

const PRESETS: Array<{ label: string; hint: string; draft: Omit<Draft, 'id'> }> = [
  {
    label: 'Daily rashifal',
    hint: 'Every morning at 6:00',
    draft: { name: 'Daily rashifal', enabled: true, schedule: { mode: 'daily', time: '06:00' }, config: { kind: 'rashifal', period: 'D', format: 'album' } },
  },
  {
    label: 'Weekly rashifal',
    hint: 'Sundays at 7:00',
    draft: { name: 'Weekly rashifal', enabled: true, schedule: { mode: 'weekly', time: '07:00', days: [0] }, config: { kind: 'rashifal', period: 'W', format: 'album' } },
  },
  {
    label: 'Monthly rashifal',
    hint: 'Checks daily, posts once per new month',
    draft: { name: 'Monthly rashifal', enabled: true, schedule: { mode: 'daily', time: '08:00' }, config: { kind: 'rashifal', period: 'M', format: 'album' } },
  },
  {
    label: 'Yearly rashifal',
    hint: 'Checks daily, posts once per new year',
    draft: { name: 'Yearly rashifal', enabled: true, schedule: { mode: 'daily', time: '09:00' }, config: { kind: 'rashifal', period: 'Y', format: 'cover' } },
  },
  ...WEATHER_SLOTS.map((slot) => ({
    label: `${SLOT_INFO[slot].en} weather`,
    hint: `Every day at ${SLOT_INFO[slot].defaultTime}`,
    draft: {
      name: `${SLOT_INFO[slot].en} weather`,
      enabled: true,
      schedule: { mode: 'daily' as const, time: SLOT_INFO[slot].defaultTime },
      config: { kind: 'weather' as const, slot },
    },
  })),
]

function AutomationsPage() {
  const confirm = useConfirm()
  const { automations, collections } = Route.useLoaderData()
  const router = useRouter()
  const { busy, run } = useAction()
  const [draft, setDraft] = useState<Draft | null>(null)

  const edit = (a: Automation) => setDraft({ id: a.id, name: a.name, enabled: a.enabled, schedule: fromCron(a.cron), config: a.config })

  return (
    <>
      <PageHeader
        title="Automations"
        subtitle="Recurring jobs that create and publish posts on a schedule (Nepal time)."
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setDraft({ id: null, ...PRESETS[0].draft })}
          >
            New automation
          </Button>
        }
      />

      <div className="mb-6">
        <p className="mb-3 text-sm font-semibold text-muted">{automations.length === 0 ? 'Quick start' : 'Add from a preset'}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
          {PRESETS.map((p) => {
            const Icon = p.draft.config.kind === 'weather' ? CloudSun : Sparkles
            const exists = automations.some((a) => JSON.stringify(a.config) === JSON.stringify(p.draft.config))
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setDraft({ id: null, ...p.draft })}
                className="rounded-xl border border-border bg-surface p-3.5 text-left transition-colors hover:border-accent"
              >
                <Icon className="mb-2 size-5 text-accent" />
                <p className="font-bold leading-tight">{p.label}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">{exists ? 'Already set up' : p.hint}</p>
              </button>
            )
          })}
        </div>
      </div>

      <Card>
        {automations.length === 0 ? (
          <EmptyState icon={<Bot className="size-5" />} title="No automations yet" body="Pick a quick-start above, or create a library automation to post quotes and greetings." />
        ) : (
          <ul className="divide-y divide-border">
            {automations.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{a.name}</p>
                    {!a.enabled && <Badge>paused</Badge>}
                    {a.lastStatus === 'ok' && <Badge tone="ok">last run ok</Badge>}
                    {a.lastStatus === 'error' && <Badge tone="bad">last run failed</Badge>}
                    {a.lastStatus === 'skipped' && <Badge tone="warn">skipped</Badge>}
                  </div>
                  <p className="text-sm text-muted">{describe(a.cron)} · {describeConfig(a.config)}</p>
                  <p className="text-sm text-muted">
                    {a.enabled ? <>Next: <strong className="font-semibold text-fg">{formatNpt(a.nextRunAt)}</strong> ({formatRelative(a.nextRunAt)})</> : 'Not scheduled'}
                    {a.lastRunAt && <> · Last: {formatRelative(a.lastRunAt)}</>}
                  </p>
                  {a.lastMessage && a.lastStatus !== 'ok' && (
                    <p className={cx('mt-0.5 text-sm', a.lastStatus === 'error' ? 'text-bad' : 'text-warn')}>{a.lastMessage}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Toggle
                    checked={a.enabled}
                    onChange={async (enabled) => {
                      await run(`t-${a.id}`, () => toggleAutomationFn({ data: { id: a.id, enabled } }), enabled ? 'Automation resumed' : 'Automation paused')
                      await router.invalidate()
                    }}
                  />
                  <Button
                    size="sm"
                    icon={<Play className="size-4" />}
                    loading={busy === `run-${a.id}`}
                    onClick={async () => {
                      if (!(await confirm({ title: `Run “${a.name}” now?`, message: 'This creates a post and publishes it to Facebook straight away.', confirmLabel: 'Run and publish' }))) return
                      await run(`run-${a.id}`, () => runAutomationNowFn({ data: { id: a.id } }), 'Automation ran. Check Posts for the result.')
                      await router.invalidate()
                    }}
                  >
                    Run now
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} aria-label="Edit" onClick={() => edit(a)} />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="size-4" />}
                    aria-label="Delete"
                    onClick={async () => {
                      if (!(await confirm({ title: `Delete “${a.name}”?`, message: 'It stops running. Posts it already made are kept.', confirmLabel: 'Delete', tone: 'danger' }))) return
                      await run('del', () => deleteAutomationFn({ data: { id: a.id } }), 'Automation deleted')
                      await router.invalidate()
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AutomationModal
        draft={draft}
        collections={collections}
        onClose={() => setDraft(null)}
        onSaved={async () => {
          setDraft(null)
          await router.invalidate()
        }}
      />
    </>
  )
}

function AutomationModal({ draft, collections, onClose, onSaved }: { draft: Draft | null; collections: string[]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft | null>(draft)
  const [runs, setRuns] = useState<{ ok: boolean; runs?: number[]; error?: string } | null>(null)
  const { busy, run } = useAction()
  const [prev, setPrev] = useState(draft)
  if (draft !== prev) {
    setPrev(draft)
    setD(draft)
  }

  const cron = d ? toCron(d.schedule) : ''
  useEffect(() => {
    if (!d || cron.split(/\s+/).length < 5) return setRuns(null)
    const t = setTimeout(() => previewScheduleFn({ data: { cron } }).then(setRuns), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cron])

  if (!d) return null
  const cfg = d.config
  const setCfg = (config: AutomationConfig) => setD({ ...d, config })

  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      title={d.id ? 'Edit automation' : 'New automation'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy === 'save'}
            onClick={async () => {
              const ok = await run('save', () => saveAutomationFn({ data: { id: d.id, name: d.name, cron, enabled: d.enabled, config: d.config } }), 'Automation saved')
              if (ok) onSaved()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Name"><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>

        <Field label="What to post">
          <Select
            value={cfg.kind}
            onChange={(e) =>
              setCfg(
                e.target.value === 'rashifal'
                  ? { kind: 'rashifal', period: 'D', format: 'album' }
                  : e.target.value === 'weather'
                    ? { kind: 'weather', slot: 'morning' }
                    : { kind: 'library', collection: collections[0] ?? '', order: 'sequential' },
              )
            }
          >
            <option value="rashifal">Rashifal from Nepali Patro</option>
            <option value="weather">Weather for Damak</option>
            <option value="library">An item from the content library</option>
          </Select>
        </Field>

        {cfg.kind === 'rashifal' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Period">
              <Select value={cfg.period} onChange={(e) => setCfg({ ...cfg, period: e.target.value as RashifalPeriod, format: e.target.value === 'Y' ? 'cover' : cfg.format })}>
                {RASHIFAL_PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
              </Select>
            </Field>
            <Field label="Format">
              <Select value={cfg.period === 'Y' ? 'cover' : cfg.format} disabled={cfg.period === 'Y'} onChange={(e) => setCfg({ ...cfg, format: e.target.value as 'album' | 'cover' })}>
                <option value="album">Album (cover + 12 images)</option>
                <option value="cover">Cover + text in caption</option>
              </Select>
            </Field>
            <p className="text-[13px] leading-snug text-muted sm:col-span-2">
              Each set is posted once. If Nepali Patro hasn't published yet, it retries every 15 minutes (up to 6 hours).
              For monthly and yearly, a daily check is fine: it only posts when a new set appears. Credit to Nepali Patro is always included.
            </p>
          </div>
        ) : cfg.kind === 'weather' ? (
          <div className="space-y-2">
            <Field label="Part of day">
              <Select
                value={cfg.slot}
                onChange={(e) => {
                  const slot = e.target.value as WeatherSlot
                  setD({ ...d, config: { kind: 'weather', slot }, schedule: d.schedule.mode === 'custom' ? d.schedule : { ...d.schedule, time: SLOT_INFO[slot].defaultTime } })
                }}
              >
                {WEATHER_SLOTS.map((s) => <option key={s} value={s}>{SLOT_INFO[s].en} · {SLOT_INFO[s].np}</option>)}
              </Select>
            </Field>
            <p className="text-[13px] leading-snug text-muted">
              A fresh forecast is fetched at posting time. Morning shows today's outlook, afternoon the current conditions,
              evening tonight and tomorrow. Credit to Open-Meteo is always included.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Collection" hint={collections.length === 0 ? <>Add items in the <Link to="/library" className="font-semibold text-accent">Library</Link> first.</> : undefined}>
              <Input list="auto-collections" value={cfg.collection} onChange={(e) => setCfg({ ...cfg, collection: e.target.value })} />
              <datalist id="auto-collections">{collections.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Order">
              <Select value={cfg.order} onChange={(e) => setCfg({ ...cfg, order: e.target.value as 'sequential' | 'random' })}>
                <option value="sequential">In order, then repeat</option>
                <option value="random">Random (least-posted first)</option>
              </Select>
            </Field>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm font-semibold">Schedule (Nepal time)</p>
          <div className="grid grid-cols-3 gap-2">
            {(['daily', 'weekly', 'custom'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() =>
                  setD({
                    ...d,
                    schedule:
                      m === 'custom'
                        ? { mode: 'custom', cron }
                        : m === 'weekly'
                          ? { mode: 'weekly', time: d.schedule.mode === 'custom' ? '07:00' : d.schedule.time, days: d.schedule.mode === 'weekly' ? d.schedule.days : [0] }
                          : { mode: 'daily', time: d.schedule.mode === 'custom' ? '06:00' : d.schedule.time },
                  })
                }
                className={cx(
                  'rounded-lg border px-3 py-2 text-sm font-semibold capitalize',
                  d.schedule.mode === m ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:bg-surface-2',
                )}
              >
                {m}
              </button>
            ))}
          </div>
          {d.schedule.mode !== 'custom' && (
            <Input type="time" value={d.schedule.time} onChange={(e) => setD({ ...d, schedule: { ...d.schedule, time: e.target.value } as ScheduleUI })} className="w-40" />
          )}
          {d.schedule.mode === 'weekly' && (
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((label, i) => {
                const s = d.schedule as Extract<ScheduleUI, { mode: 'weekly' }>
                const on = s.days.includes(i)
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setD({ ...d, schedule: { ...s, days: on ? s.days.filter((x) => x !== i) : [...s.days, i] } })}
                    className={cx('h-9 w-12 rounded-lg border text-sm font-semibold', on ? 'border-accent bg-accent text-accent-fg' : 'border-border text-muted')}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
          {d.schedule.mode === 'custom' && (
            <Field label="Cron expression" hint="minute hour day-of-month month day-of-week, e.g. “30 5 * * *” = 5:30 AM daily.">
              <Input className="font-mono" value={d.schedule.cron} onChange={(e) => setD({ ...d, schedule: { mode: 'custom', cron: e.target.value } })} />
            </Field>
          )}
          {runs && (
            <p className={cx('text-sm', runs.ok ? 'text-muted' : 'text-bad')}>
              {runs.ok ? <>Next runs: {runs.runs!.map((r) => formatNpt(r)).join(' · ')}</> : runs.error}
            </p>
          )}
        </div>

        <Toggle checked={d.enabled} onChange={(enabled) => setD({ ...d, enabled })} label="Enabled" />
      </div>
    </Modal>
  )
}
