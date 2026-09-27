import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { WEATHER_SLOTS, buildWeatherView } from '#/lib/weather'
import { createPost, publishNow } from '#/server/posts'
import { getSettings } from '#/server/settings'
import { listTemplates } from '#/server/templates'
import { fetchWeather } from '#/server/weather'
import { buildWeatherCaption, buildWeatherPost, renderWeatherImage } from '#/server/weather-posts'
import { authMiddleware } from './middleware'

const slotSchema = z.enum(WEATHER_SLOTS)

export const getWeatherOverviewFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const s = await getSettings()
    const templates = (await listTemplates()).filter((t) => t.kind === 'weather').map((t) => ({ id: t.id, name: t.name }))
    let data = null
    let error: string | null = null
    try {
      data = await fetchWeather()
    } catch (err) {
      error = (err as Error).message
    }
    return {
      data,
      error,
      views: data ? Object.fromEntries(WEATHER_SLOTS.map((slot) => [slot, buildWeatherView(data, slot)])) : null,
      templates,
      weatherTemplateId: s.weatherTemplateId,
      place: { np: s.weatherPlaceNp, en: s.weatherPlaceEn, lat: s.weatherLat, lon: s.weatherLon },
    }
  })

export const refreshWeatherFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async () => {
    await fetchWeather({ force: true })
    return { ok: true }
  })

export const previewWeatherImageFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ slot: slotSchema }))
  .handler(async ({ data }) => {
    const img = await renderWeatherImage(buildWeatherView(await fetchWeather(), data.slot))
    return { dataUrl: `data:${img.mime};base64,${img.data.toString('base64')}` }
  })

export const previewWeatherCaptionFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ slot: slotSchema }))
  .handler(async ({ data }) => {
    const s = await getSettings()
    const view = buildWeatherView(await fetchWeather(), data.slot)
    return { caption: buildWeatherCaption(s.weatherCaption, view, { brand: s.brandName, hashtags: s.weatherHashtags }) }
  })

export const createWeatherPostFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      slot: slotSchema,
      mode: z.enum(['draft', 'schedule', 'now']),
      scheduledAt: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (data.mode === 'schedule' && (!data.scheduledAt || data.scheduledAt < Date.now() - 60_000)) {
      throw new Error('Pick a future date and time.')
    }
    const built = await buildWeatherPost(data.slot, { force: data.mode === 'now' })
    const post = await createPost({
      ...built,
      status: data.mode === 'draft' ? 'draft' : 'scheduled',
      scheduledAt: data.mode === 'schedule' ? data.scheduledAt : Date.now(),
    })
    if (data.mode === 'now') return publishNow(post.id)
    return post
  })
