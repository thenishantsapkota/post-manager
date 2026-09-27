import { z } from 'zod'
import type { WeatherData } from '#/lib/weather'
import { config } from './config'
import { getSettings } from './settings'

// Open-Meteo client (https://open-meteo.com). Free, no key needed; set
// OPEN_METEO_API_KEY to use their commercial API instead.

const CACHE_MS = 10 * 60_000
const g = globalThis as unknown as { __weatherCache?: { key: string; at: number; data: WeatherData } }

const forecastSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    wind_speed_10m: z.number(),
    weather_code: z.number(),
    is_day: z.number(),
  }),
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number()),
    precipitation_probability: z.array(z.number().nullable()),
    weather_code: z.array(z.number()),
    is_day: z.array(z.number()),
  }),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_probability_max: z.array(z.number().nullable()),
    sunrise: z.array(z.string()),
    sunset: z.array(z.string()),
    uv_index_max: z.array(z.number().nullable()),
  }),
})

function endpoint(host: 'api' | 'air-quality-api', path: string, params: Record<string, string>) {
  const key = config.openMeteoKey
  const base = key ? `https://customer-${host}.open-meteo.com` : `https://${host}.open-meteo.com`
  const u = new URL(`${base}${path}`)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  if (key) u.searchParams.set('apikey', key)
  return u
}

async function getJson(u: URL) {
  const res = await fetch(u, { signal: AbortSignal.timeout(20_000), headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Open-Meteo returned HTTP ${res.status}`)
  return res.json()
}

export async function fetchWeather(opts: { force?: boolean } = {}): Promise<WeatherData> {
  const s = await getSettings()
  const lat = s.weatherLat
  const lon = s.weatherLon
  const cacheKey = `${lat},${lon},${s.weatherPlaceNp}`
  const cached = g.__weatherCache
  if (!opts.force && cached && cached.key === cacheKey && Date.now() - cached.at < CACHE_MS) return cached.data

  const common = { latitude: lat, longitude: lon, timezone: 'Asia/Kathmandu' }
  let raw: unknown
  try {
    raw = await getJson(
      endpoint('api', '/v1/forecast', {
        ...common,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
        hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max',
        forecast_days: '3',
      }),
    )
  } catch (err) {
    throw new Error(`Could not fetch weather: ${(err as Error).message}`)
  }
  const parsed = forecastSchema.safeParse(raw)
  if (!parsed.success) throw new Error('Open-Meteo returned an unexpected response')
  const f = parsed.data

  // Air quality is a bonus; never fail the post because of it.
  let aqi: WeatherData['aqi'] = null
  try {
    const a = (await getJson(endpoint('air-quality-api', '/v1/air-quality', { ...common, current: 'us_aqi,pm2_5' }))) as {
      current?: { us_aqi?: number | null; pm2_5?: number | null }
    }
    if (typeof a.current?.us_aqi === 'number') aqi = { usAqi: a.current.us_aqi, pm25: a.current.pm2_5 ?? 0 }
  } catch {
    aqi = null
  }

  const data: WeatherData = {
    place: { np: s.weatherPlaceNp, en: s.weatherPlaceEn },
    fetchedAt: Date.now(),
    current: {
      time: f.current.time.slice(0, 16),
      temp: f.current.temperature_2m,
      feelsLike: f.current.apparent_temperature,
      humidity: f.current.relative_humidity_2m,
      windKmh: f.current.wind_speed_10m,
      code: f.current.weather_code,
      isDay: f.current.is_day === 1,
    },
    hourly: f.hourly.time.map((time, i) => ({
      time: time.slice(0, 16),
      temp: f.hourly.temperature_2m[i],
      rainChance: f.hourly.precipitation_probability[i] ?? 0,
      code: f.hourly.weather_code[i],
      isDay: f.hourly.is_day[i] === 1,
    })),
    daily: f.daily.time.map((date, i) => ({
      date,
      code: f.daily.weather_code[i],
      high: f.daily.temperature_2m_max[i],
      low: f.daily.temperature_2m_min[i],
      rainChance: f.daily.precipitation_probability_max[i] ?? 0,
      sunrise: f.daily.sunrise[i].slice(11, 16),
      sunset: f.daily.sunset[i].slice(11, 16),
      uv: f.daily.uv_index_max[i] ?? 0,
    })),
    aqi,
  }
  g.__weatherCache = { key: cacheKey, at: Date.now(), data }
  return data
}
