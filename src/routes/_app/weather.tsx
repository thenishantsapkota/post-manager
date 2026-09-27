import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Bot, ChevronDown, CloudSun, Droplets, Info, RefreshCw, Wind } from 'lucide-react'
import { SchedulePicker, scheduleEpoch } from '#/components/schedule-picker'
import type { ScheduleValue } from '#/components/schedule-picker'
import { Badge, Button, Card, CardHeader, EmptyState, Field, PageHeader, Select, Spinner, Tabs, cx, useAction } from '#/components/ui'
import { WeatherIcon } from '#/components/weather-icon'
import { setRashifalTemplateFn } from '#/functions/templates.functions'
import {
  createWeatherPostFn,
  getWeatherOverviewFn,
  previewWeatherCaptionFn,
  previewWeatherImageFn,
  refreshWeatherFn,
} from '#/functions/weather.functions'
import { describeCode, SLOT_INFO, WEATHER_SLOTS, aqiLabel, weatherDetailLines } from '#/lib/weather'
import type { WeatherSlot } from '#/lib/weather'
import { formatRelative, nptDateKey, nptTime } from '#/lib/time'
import { addDays } from '#/lib/time'

export const Route = createFileRoute('/_app/weather')({
  validateSearch: (s: Record<string, unknown>): { slot?: WeatherSlot } =>
    WEATHER_SLOTS.includes(s.slot as WeatherSlot) ? { slot: s.slot as WeatherSlot } : {},
  loader: () => getWeatherOverviewFn(),
  component: WeatherPage,
})

/** Nepal-time slot of right now, so the page opens on the relevant tab. */
function currentSlot(): WeatherSlot {
  const h = Number(nptTime().slice(0, 2))
  return h < 11 ? 'morning' : h < 16 ? 'afternoon' : 'evening'
}

/** Next occurrence of the slot's usual posting time. */
function slotSchedule(slot: WeatherSlot): ScheduleValue {
  const time = SLOT_INFO[slot].defaultTime
  const today = nptDateKey()
  const date = nptTime() < time ? today : addDays(today, 1)
  return { mode: 'now', date, time }
}

function WeatherPage() {
  const d = Route.useLoaderData()
  const { slot = currentSlot() } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const { busy, run } = useAction()
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState<string | null>(null)
  const [showCaption, setShowCaption] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleValue>(() => slotSchedule(slot))

  const view = d.views?.[slot] ?? null
  const fetchedAt = d.data?.fetchedAt

  useEffect(() => {
    setSchedule((s) => ({ ...slotSchedule(slot), mode: s.mode }))
    setCaption(null)
    setShowCaption(false)
  }, [slot])

  useEffect(() => {
    if (!d.data) return
    let cancelled = false
    setPreview(null)
    previewWeatherImageFn({ data: { slot } }).then(
      (r) => !cancelled && setPreview(r.dataUrl),
      () => !cancelled && setPreview(''),
    )
    return () => {
      cancelled = true
    }
  }, [slot, fetchedAt, d.weatherTemplateId, d.data])

  async function refresh() {
    await run('refresh', () => refreshWeatherFn(), 'Weather updated')
    await router.invalidate()
  }

  async function toggleCaption() {
    setShowCaption((v) => !v)
    if (caption === null) {
      const r = await run('cap', () => previewWeatherCaptionFn({ data: { slot } }))
      if (r) setCaption(r.caption)
    }
  }

  async function createPost() {
    const res = await run('post', () =>
      createWeatherPostFn({
        data: { slot, mode: schedule.mode, scheduledAt: schedule.mode === 'schedule' ? scheduleEpoch(schedule) : undefined },
      }),
    )
    if (!res) return
    const status = res.status === 'published' ? 'published' : res.status === 'failed' ? 'failed' : res.status === 'draft' ? 'draft' : 'scheduled'
    await router.navigate({ to: '/posts', search: { status } })
  }

  const cur = d.data?.current
  const curCode = cur ? describeCode(cur.code) : null
  const aqi = d.data?.aqi ? aqiLabel(d.data.aqi.usAqi) : null

  return (
    <>
      <PageHeader
        title="Weather"
        subtitle={`Live forecast for ${d.place.np} (${d.place.en}), posted in the morning, afternoon and evening.`}
        actions={
          <Button icon={<RefreshCw className="size-4" />} loading={busy === 'refresh'} onClick={refresh}>
            Refresh
          </Button>
        }
      />

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <Info className="mt-0.5 size-5 shrink-0 text-accent" />
        <p className="text-sm leading-relaxed">
          Weather data from{' '}
          <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="font-semibold text-accent">Open-Meteo.com</a>{' '}
          (CC BY 4.0). Every weather image and caption carries this credit automatically. Location and caption are set in{' '}
          <Link to="/settings" className="font-semibold text-accent">Settings</Link>.
        </p>
      </div>

      {d.error || !d.data || !view || !cur || !curCode ? (
        <Card>
          <EmptyState icon={<CloudSun className="size-5" />} title="Weather unavailable" body={d.error ?? 'Could not load the forecast.'} action={<Button onClick={refresh}>Try again</Button>} />
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
              <div className="flex items-center gap-4">
                <WeatherIcon icon={curCode.icon} isDay={cur.isDay} className="size-14" />
                <div>
                  <p className="text-4xl font-extrabold tabular-nums leading-none">{Math.round(cur.temp)}°C</p>
                  <p className="mt-1 font-semibold">{curCode.np} <span className="font-normal text-muted">· {curCode.en}</span></p>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span className="text-muted">Feels like <strong className="text-fg">{Math.round(cur.feelsLike)}°</strong></span>
                <span className="flex items-center gap-1.5 text-muted"><Droplets className="size-4" /> <strong className="text-fg">{cur.humidity}%</strong></span>
                <span className="flex items-center gap-1.5 text-muted"><Wind className="size-4" /> <strong className="text-fg">{Math.round(cur.windKmh)} km/h</strong></span>
                {d.data.aqi && aqi && (
                  <span className="flex items-center gap-1.5 text-muted">
                    AQI <Badge tone={aqi.tone}>{d.data.aqi.usAqi} · {aqi.en}</Badge>
                  </span>
                )}
              </div>
              <p className="ml-auto text-[13px] text-muted">Updated {formatRelative(d.data.fetchedAt)}</p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
              {d.data.daily.slice(0, 3).map((day, i) => {
                const c = describeCode(day.code)
                return (
                  <div key={day.date} className="flex items-center gap-3 px-5 py-3">
                    <WeatherIcon icon={c.icon} isDay className="size-7" />
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold">{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(`${day.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })}</p>
                      <p className="truncate text-muted">
                        {Math.round(day.high)}° / {Math.round(day.low)}° · rain {day.rainChance}%
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="mb-5">
            <Tabs
              value={slot}
              onChange={(s) => navigate({ search: { slot: s } })}
              items={WEATHER_SLOTS.map((s) => ({ value: s, label: `${SLOT_INFO[s].en} · ${SLOT_INFO[s].np}` }))}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
            <div className="space-y-6">
              <Card>
                <CardHeader title={`${SLOT_INFO[slot].emoji} ${view.title}`} subtitle={slotHint(slot)} />
                <div className="space-y-4 p-5">
                  <p className="text-[17px] leading-relaxed">{view.summary}</p>
                  <ul className="space-y-1.5 text-[15px]">
                    {weatherDetailLines(view).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                  {view.strip.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 rounded-xl bg-surface-2 p-3">
                      {view.strip.map((h) => (
                        <div key={h.label} className="flex flex-col items-center gap-1 text-center">
                          <span className="text-[13px] font-semibold text-muted">{h.label}</span>
                          <WeatherIcon icon={h.icon} isDay={h.isDay} className="size-7" />
                          <span className="font-bold">{h.temp}</span>
                          <span className="flex items-center gap-0.5 text-[12px] text-info"><Droplets className="size-3" />{h.rainChance}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={toggleCaption} className="flex w-full items-center justify-between border-t border-border pt-3 text-sm font-semibold text-muted hover:text-fg">
                    Caption preview <ChevronDown className={cx('size-4 transition-transform', showCaption && 'rotate-180')} />
                  </button>
                  {showCaption && (
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-sans text-sm leading-relaxed">{caption ?? 'Loading…'}</pre>
                  )}
                </div>
              </Card>

              <Card>
                <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <Bot className="size-6 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">Post this automatically every day</p>
                    <p className="text-sm text-muted">Automations fetch a fresh forecast at posting time. Presets: morning 6:30, afternoon 1:00, evening 7:00.</p>
                  </div>
                  <Link to="/automations"><Button>Set up</Button></Link>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <div className="checker relative grid aspect-[4/5] place-items-center overflow-hidden rounded-t-xl">
                  {preview ? <img src={preview} alt="Weather post preview" className="size-full object-contain" /> : preview === '' ? <p className="text-sm text-bad">Preview failed</p> : <Spinner />}
                </div>
                <p className="px-4 py-2.5 text-center text-[13px] text-muted">Exactly as it will be posted</p>
              </Card>

              <Card>
                <CardHeader title="Create post" />
                <div className="space-y-4 p-5">
                  <SchedulePicker value={schedule} onChange={setSchedule} />
                  {schedule.mode === 'schedule' && (
                    <p className="text-[13px] text-warn">A scheduled post uses today's forecast as it is now. For daily posts, use an automation so the data is fresh.</p>
                  )}
                  <Button variant="primary" className="w-full" loading={busy === 'post'} onClick={createPost}>
                    {schedule.mode === 'now' ? 'Publish now' : schedule.mode === 'schedule' ? 'Schedule post' : 'Save as draft'}
                  </Button>
                </div>
              </Card>

              <Card>
                <CardHeader title="Design" />
                <div className="space-y-3 p-5">
                  <Field label="Weather image">
                    <Select
                      value={d.weatherTemplateId}
                      onChange={async (e) => {
                        await run('tpl', () => setRashifalTemplateFn({ data: { slot: 'weather', id: e.target.value } }), 'Design updated')
                        await router.invalidate()
                      }}
                    >
                      <option value="">Built-in design</option>
                      {d.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                  </Field>
                  <Link to="/templates" className="inline-block text-sm font-semibold text-accent">Make a weather template →</Link>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function slotHint(slot: WeatherSlot) {
  if (slot === 'morning') return "Today's outlook: high/low, rain chance, sunrise and sunset."
  if (slot === 'afternoon') return 'Conditions right now and the rest of the day.'
  return "Tonight's low and tomorrow's forecast."
}
