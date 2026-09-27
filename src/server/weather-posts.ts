import { describeDate } from '#/lib/nepali-date'
import { weatherCaptionCredit, weatherImageCredit, withWeatherCredit } from '#/lib/credit'
import { SLOT_INFO, buildWeatherView, weatherDetailLines, weatherVars } from '#/lib/weather'
import type { WeatherSlot, WeatherView } from '#/lib/weather'
import { loadBrand } from './render/canvas'
import type { Brand } from './render/canvas'
import { renderTemplate } from './render/engine'
import { renderWeatherCard } from './render/weather-card'
import { getSettings } from './settings'
import { saveMedia } from './storage'
import { baseVars, getTemplate, toTemplateData } from './templates'
import { fetchWeather } from './weather'

export async function weatherView(slot: WeatherSlot, opts: { force?: boolean } = {}) {
  return buildWeatherView(await fetchWeather(opts), slot)
}

export async function renderWeatherImage(view: WeatherView, brand?: Brand) {
  brand ??= await loadBrand()
  const s = await getSettings()
  const credit = weatherImageCredit()
  const row = s.weatherTemplateId ? await getTemplate(s.weatherTemplateId) : undefined
  if (row) {
    const vars = { ...baseVars(view.date, brand), ...weatherVars(view), credit }
    return renderTemplate(toTemplateData(row), { vars, slots: {}, weather: { icon: view.icon, isDay: view.isDay } }, brand, { credit })
  }
  return renderWeatherCard(view, brand, credit)
}

export function buildWeatherCaption(template: string, view: WeatherView, opts: { brand: string; hashtags: string }) {
  const d = describeDate(view.date)
  const vars: Record<string, string> = {
    ...weatherVars(view),
    slot_emoji: SLOT_INFO[view.slot].emoji,
    details: weatherDetailLines(view).join('\n'),
    date_bs: d.bs,
    date_ad: d.ad,
    weekday: d.weekday,
    brand: opts.brand,
    hashtags: opts.hashtags,
    credit: weatherCaptionCredit(),
  }
  const caption = template.replace(/\{([a-z_]+)\}/g, (m, k: string) => vars[k] ?? m).trim()
  // The data credit is mandatory and is appended even if the template omits it.
  return withWeatherCredit(caption)
}

export async function buildWeatherPost(slot: WeatherSlot, opts: { force?: boolean } = {}) {
  const view = await weatherView(slot, opts)
  const s = await getSettings()
  const img = await renderWeatherImage(view)
  const d = describeDate(view.date)
  const label = `${view.title} — ${view.place}, ${d.bs}`
  const media = await saveMedia(img.data, img.mime, { kind: 'generated', label, width: img.width, height: img.height })
  const caption = buildWeatherCaption(s.weatherCaption, view, { brand: s.brandName, hashtags: s.weatherHashtags })
  return { caption, mediaIds: [media.id], title: label }
}
