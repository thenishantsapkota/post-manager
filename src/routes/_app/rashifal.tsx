import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { BookOpenText, ChevronDown, Pencil, RefreshCw, Save, Sparkles } from 'lucide-react'
import { ZodiacBadge } from '#/components/zodiac-icon'
import { SchedulePicker, defaultSchedule, scheduleEpoch } from '#/components/schedule-picker'
import type { ScheduleValue } from '#/components/schedule-picker'
import { Badge, Button, Card, CardHeader, EmptyState, Field, PageHeader, Select, Spinner, Tabs, Textarea, cx, useAction } from '#/components/ui'
import {
  createRashifalPostFn,
  getRashifalOverviewFn,
  previewRashifalCaptionFn,
  previewRashifalImageFn,
  saveRashifalEditsFn,
  syncRashifalFn,
} from '#/functions/rashifal.functions'
import { setRashifalTemplateFn } from '#/functions/templates.functions'
import { SOURCE_NAME_EN, SOURCE_NAME_NP, SOURCE_URL } from '#/lib/credit'
import { SIGNS } from '#/lib/signs'
import { formatRelative } from '#/lib/time'
import { PERIOD_LABELS, PERIOD_TITLES, RASHIFAL_PERIODS } from '#/lib/types'
import type { RashifalFormat, RashifalPeriod } from '#/lib/types'

export const Route = createFileRoute('/_app/rashifal')({
  validateSearch: (s: Record<string, unknown>): { period?: RashifalPeriod } =>
    RASHIFAL_PERIODS.includes(s.period as RashifalPeriod) ? { period: s.period as RashifalPeriod } : {},
  loader: () => getRashifalOverviewFn(),
  component: RashifalPage,
})

function RashifalPage() {
  const data = Route.useLoaderData()
  const { period = 'D' } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const { busy, run } = useAction()

  const setsForPeriod = data.sets.filter((s) => s.period === period)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => setSelectedId(data.current[period] ?? setsForPeriod[0]?.id ?? null), [period, data.current, setsForPeriod[0]?.id])
  const set = setsForPeriod.find((s) => s.id === selectedId) ?? null
  const isCurrent = !!set && data.current[period] === set.id

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [previewSign, setPreviewSign] = useState<string | null>(null)
  const [format, setFormat] = useState<RashifalFormat>('album')
  const [schedule, setSchedule] = useState<ScheduleValue>(defaultSchedule())
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState<string | null>(null)
  const [showCaption, setShowCaption] = useState(false)

  const effective: RashifalFormat = period === 'Y' ? 'cover' : format

  useEffect(() => {
    setEditing(false)
    setCaption(null)
    setShowCaption(false)
    setPreviewSign(null)
  }, [set?.id])

  const previewKey = `${set?.id}|${previewSign}|${effective}|${data.signTemplateId}|${data.coverTemplateId}|${set?.updatedAt}`
  useEffect(() => {
    if (!set) return setPreview(null)
    let cancelled = false
    setPreview(null)
    previewRashifalImageFn({ data: { id: set.id, sign: previewSign as never, format: effective } }).then(
      (r) => !cancelled && setPreview(r.dataUrl),
      () => !cancelled && setPreview(''),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey])

  async function refresh() {
    await run('sync', () => syncRashifalFn(), 'Fetched latest rashifal from Nepali Patro')
    await router.invalidate()
  }

  async function saveEdits() {
    if (!set) return
    const ok = await run('edit', () => saveRashifalEditsFn({ data: { id: set.id, entries: draft } }), 'Saved your edits')
    if (ok) {
      setEditing(false)
      await router.invalidate()
    }
  }

  async function loadCaption() {
    if (!set) return
    setShowCaption((v) => !v)
    if (caption === null) {
      const r = await run('cap', () => previewRashifalCaptionFn({ data: { id: set.id } }))
      if (r) setCaption(r.caption)
    }
  }

  async function createPost() {
    if (!set) return
    const res = await run('post', () =>
      createRashifalPostFn({
        data: {
          id: set.id,
          format: effective,
          mode: schedule.mode,
          scheduledAt: schedule.mode === 'schedule' ? scheduleEpoch(schedule) : undefined,
        },
      }),
    )
    if (!res) return
    const status = res.status === 'published' ? 'published' : res.status === 'failed' ? 'failed' : res.status === 'draft' ? 'draft' : 'scheduled'
    await router.navigate({ to: '/posts', search: { status } })
  }

  const signTemplates = data.templates.filter((t) => t.kind === 'rashifal_sign')
  const coverTemplates = data.templates.filter((t) => t.kind === 'rashifal_cover')

  const periodTabs = useMemo(
    () =>
      RASHIFAL_PERIODS.map((p) => ({
        value: p,
        label: (
          <span className="inline-flex items-center gap-1.5">
            {PERIOD_LABELS[p]}
            {data.current[p] && <span className="size-1.5 rounded-full bg-ok" aria-label="available" />}
          </span>
        ),
      })),
    [data.current],
  )

  return (
    <>
      <PageHeader
        title="Rashifal"
        subtitle="Daily, weekly, monthly and yearly rashifal, fetched automatically from Nepali Patro."
        actions={
          <Button icon={<RefreshCw className="size-4" />} loading={busy === 'sync'} onClick={refresh}>
            Refresh from Nepali Patro
          </Button>
        }
      />

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <BookOpenText className="mt-0.5 size-5 shrink-0 text-accent" />
        <p className="text-sm leading-relaxed">
          Content: <strong>{SOURCE_NAME_NP} ({SOURCE_NAME_EN})</strong>,{' '}
          <a href={`https://${SOURCE_URL}`} target="_blank" rel="noreferrer" className="font-semibold text-accent">{SOURCE_URL}</a>.
          Every rashifal image carries a source line and every caption ends with the credit and the astrologer's name.
          These are added automatically and can't be switched off.
        </p>
      </div>

      {data.syncError && (
        <p className="mb-4 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">Couldn't refresh just now: {data.syncError}</p>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={period} onChange={(p) => navigate({ search: { period: p } })} items={periodTabs} />
        {setsForPeriod.length > 1 && (
          <Select className="w-auto" value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value)}>
            {setsForPeriod.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subtitle}
                {data.current[period] === s.id ? ' (current)' : ''}
              </option>
            ))}
          </Select>
        )}
      </div>

      {!set ? (
        <Card>
          <EmptyState
            icon={<Sparkles className="size-5" />}
            title={`No ${PERIOD_LABELS[period].toLowerCase()} rashifal yet`}
            body="Nepali Patro hasn't published it, or it hasn't been fetched. Try refreshing."
            action={<Button onClick={refresh} loading={busy === 'sync'}>Refresh now</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
          <Card>
            <CardHeader
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {PERIOD_TITLES[set.period]} — {set.subtitle}
                  {isCurrent ? <Badge tone="ok">current</Badge> : <Badge tone="warn">past</Badge>}
                  {set.edited && <Badge tone="accent">edited</Badge>}
                </span>
              }
              subtitle={`${set.author} · fetched ${formatRelative(set.fetchedAt)}`}
              action={
                editing ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button size="sm" variant="primary" icon={<Save className="size-4" />} loading={busy === 'edit'} onClick={saveEdits}>Save</Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    icon={<Pencil className="size-4" />}
                    onClick={() => {
                      setDraft({ ...set.entries })
                      setEditing(true)
                    }}
                  >
                    Edit text
                  </Button>
                )
              }
            />
            {set.period === 'D' && set.title && <p className="border-b border-border px-5 py-3 text-sm text-muted">{set.title}</p>}
            <ul className="divide-y divide-border">
              {SIGNS.map((s) => (
                <li key={s.key} className={cx('px-5 py-3.5', previewSign === s.key && !editing && 'bg-accent-soft/40')}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <ZodiacBadge sign={s.key} />
                      <p className="font-bold leading-tight">
                        {s.np} <span className="font-medium text-muted">· {s.en}</span>
                      </p>
                    </div>
                    {!editing && effective === 'album' && (
                      <button type="button" className="text-sm font-semibold text-accent" onClick={() => setPreviewSign(previewSign === s.key ? null : s.key)}>
                        {previewSign === s.key ? 'Show cover' : 'Preview image'}
                      </button>
                    )}
                  </div>
                  {editing ? (
                    <Textarea rows={period === 'Y' ? 10 : 4} value={draft[s.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} />
                  ) : (
                    <p className="whitespace-pre-line leading-relaxed text-fg/90">{set.entries[s.key]}</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <div className="space-y-6">
            <Card>
              <div className="checker relative grid aspect-[4/5] place-items-center overflow-hidden rounded-t-xl">
                {preview ? <img src={preview} alt="Rashifal preview" className="size-full object-contain" /> : preview === '' ? <p className="text-sm text-bad">Preview failed</p> : <Spinner />}
              </div>
              <p className="px-4 py-2.5 text-center text-[13px] text-muted">
                {previewSign ? `${SIGNS.find((s) => s.key === previewSign)?.np} image` : 'Cover image'} · exactly as it will be posted
              </p>
            </Card>

            <Card>
              <CardHeader title="Create post" />
              <div className="space-y-4 p-5">
                <Field label="Format" hint={period === 'Y' ? 'Yearly readings are too long for images, so they go in the caption under one cover image.' : undefined}>
                  <Select value={effective} disabled={period === 'Y'} onChange={(e) => setFormat(e.target.value as RashifalFormat)}>
                    <option value="album">Album: cover + 12 sign images</option>
                    <option value="cover">Single cover, full text in caption</option>
                  </Select>
                </Field>
                <SchedulePicker value={schedule} onChange={setSchedule} />
                {!isCurrent && <p className="text-sm text-warn">This is a past set; its dates won't match today.</p>}
                <Button variant="primary" className="w-full" loading={busy === 'post'} onClick={createPost}>
                  {schedule.mode === 'now' ? 'Publish now' : schedule.mode === 'schedule' ? 'Schedule post' : 'Save as draft'}
                </Button>
                <button type="button" onClick={loadCaption} className="flex w-full items-center justify-between text-sm font-semibold text-muted hover:text-fg">
                  Caption preview <ChevronDown className={cx('size-4 transition-transform', showCaption && 'rotate-180')} />
                </button>
                {showCaption && (
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-sans text-sm leading-relaxed">
                    {caption ?? 'Loading…'}
                  </pre>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Design" subtitle="Use your own templates or the built-in design." />
              <div className="space-y-4 p-5">
                <Field label="Sign images">
                  <Select
                    value={data.signTemplateId}
                    onChange={async (e) => {
                      await run('tpl', () => setRashifalTemplateFn({ data: { slot: 'sign', id: e.target.value } }), 'Design updated')
                      await router.invalidate()
                    }}
                  >
                    <option value="">Built-in design</option>
                    {signTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </Field>
                <Field label="Cover image">
                  <Select
                    value={data.coverTemplateId}
                    onChange={async (e) => {
                      await run('tpl', () => setRashifalTemplateFn({ data: { slot: 'cover', id: e.target.value } }), 'Design updated')
                      await router.invalidate()
                    }}
                  >
                    <option value="">Built-in design</option>
                    {coverTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </Field>
                <Link to="/templates" className="inline-block text-sm font-semibold text-accent">Manage templates →</Link>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
