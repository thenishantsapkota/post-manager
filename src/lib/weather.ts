import { toNepaliDigits } from './nepali-date'

// Shared (client + server) weather logic: WMO codes → Nepali, the three
// posting slots, and the summary text used by images, templates and captions.

export const WEATHER_SLOTS = ['morning', 'afternoon', 'evening'] as const
export type WeatherSlot = (typeof WEATHER_SLOTS)[number]

export const SLOT_INFO: Record<WeatherSlot, { np: string; en: string; emoji: string; defaultTime: string }> = {
  morning: { np: 'बिहानको मौसम', en: 'Morning', emoji: '🌅', defaultTime: '06:30' },
  afternoon: { np: 'दिउँसोको मौसम', en: 'Afternoon', emoji: '☀️', defaultTime: '13:00' },
  evening: { np: 'बेलुकीको मौसम', en: 'Evening', emoji: '🌙', defaultTime: '19:00' },
}

export type WeatherIconKey =
  | 'clear'
  | 'mostly'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy'
  | 'thunder'
  | 'snow'

export interface WeatherData {
  place: { np: string; en: string }
  fetchedAt: number
  current: {
    /** Local Nepal time, YYYY-MM-DDTHH:mm */
    time: string
    temp: number
    feelsLike: number
    humidity: number
    windKmh: number
    code: number
    isDay: boolean
  }
  hourly: Array<{ time: string; temp: number; rainChance: number; code: number; isDay: boolean }>
  daily: Array<{ date: string; code: number; high: number; low: number; rainChance: number; sunrise: string; sunset: string; uv: number }>
  aqi: { usAqi: number; pm25: number } | null
}

const CODES: Record<number, [np: string, en: string, icon: WeatherIconKey]> = {
  0: ['सफा आकाश', 'Clear sky', 'clear'],
  1: ['प्रायः सफा', 'Mainly clear', 'mostly'],
  2: ['आंशिक बदली', 'Partly cloudy', 'partly'],
  3: ['बदली', 'Overcast', 'cloudy'],
  45: ['कुहिरो', 'Fog', 'fog'],
  48: ['हुस्सु र कुहिरो', 'Rime fog', 'fog'],
  51: ['हल्का सिमसिमे पानी', 'Light drizzle', 'drizzle'],
  53: ['सिमसिमे पानी', 'Drizzle', 'drizzle'],
  55: ['बाक्लो सिमसिमे पानी', 'Dense drizzle', 'drizzle'],
  56: ['चिसो सिमसिमे पानी', 'Freezing drizzle', 'drizzle'],
  57: ['चिसो सिमसिमे पानी', 'Freezing drizzle', 'drizzle'],
  61: ['हल्का वर्षा', 'Light rain', 'rain'],
  63: ['मध्यम वर्षा', 'Moderate rain', 'rain'],
  65: ['भारी वर्षा', 'Heavy rain', 'heavy'],
  66: ['चिसो वर्षा', 'Freezing rain', 'rain'],
  67: ['भारी चिसो वर्षा', 'Heavy freezing rain', 'heavy'],
  71: ['हल्का हिमपात', 'Light snow', 'snow'],
  73: ['हिमपात', 'Snow', 'snow'],
  75: ['भारी हिमपात', 'Heavy snow', 'snow'],
  77: ['हिउँका कण', 'Snow grains', 'snow'],
  80: ['हल्का झरी', 'Light showers', 'rain'],
  81: ['झरी', 'Showers', 'rain'],
  82: ['भारी झरी', 'Violent showers', 'heavy'],
  85: ['हिम झरी', 'Snow showers', 'snow'],
  86: ['भारी हिम झरी', 'Heavy snow showers', 'snow'],
  95: ['मेघगर्जनसहित वर्षा', 'Thunderstorm', 'thunder'],
  96: ['असिनासहित मेघगर्जन', 'Thunderstorm with hail', 'thunder'],
  99: ['असिनासहित मेघगर्जन', 'Thunderstorm with hail', 'thunder'],
}

export function describeCode(code: number) {
  const [np, en, icon] = CODES[code] ?? ['मौसम', 'Weather', 'cloudy']
  return { np, en, icon }
}

export function aqiLabel(aqi: number) {
  if (aqi <= 50) return { np: 'राम्रो', en: 'Good', tone: 'ok' as const }
  if (aqi <= 100) return { np: 'मध्यम', en: 'Moderate', tone: 'warn' as const }
  if (aqi <= 150) return { np: 'संवेदनशीलका लागि अस्वस्थ', en: 'Unhealthy for sensitive groups', tone: 'warn' as const }
  if (aqi <= 200) return { np: 'अस्वस्थ', en: 'Unhealthy', tone: 'bad' as const }
  if (aqi <= 300) return { np: 'धेरै अस्वस्थ', en: 'Very unhealthy', tone: 'bad' as const }
  return { np: 'खतरनाक', en: 'Hazardous', tone: 'bad' as const }
}

const np = (n: number) => toNepaliDigits(Math.round(n))

/** "17:45" → "बेलुका ५:४५" */
export function nepaliClock(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const part = h >= 4 && h < 12 ? 'बिहान' : h >= 12 && h < 16 ? 'दिउँसो' : h >= 16 && h < 19 ? 'बेलुका' : 'राति'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${part} ${toNepaliDigits(h12)}${m ? `:${toNepaliDigits(String(m).padStart(2, '0'))}` : ' बजे'}`
}

function addHours(time: string, hours: number) {
  const d = new Date(`${time}:00Z`)
  d.setUTCHours(d.getUTCHours() + hours)
  return d.toISOString().slice(0, 16)
}

export interface StripItem {
  label: string
  icon: WeatherIconKey
  isDay: boolean
  temp: string
  rainChance: string
}

/** Everything a slot shows, already formatted (Nepali digits). */
export interface WeatherView {
  slot: WeatherSlot
  title: string
  emoji: string
  place: string
  /** Date the post is about, YYYY-MM-DD */
  date: string
  icon: WeatherIconKey
  isDay: boolean
  condition: string
  temp: string
  feelsLike: string
  high: string
  low: string
  rainChance: string
  humidity: string
  wind: string
  sunrise: string
  sunset: string
  uv: string
  aqi: string
  aqiLabel: string
  summary: string
  strip: StripItem[]
  /** Evening slot: tomorrow's outlook */
  tomorrow: { condition: string; high: string; low: string; rainChance: string } | null
}

function rainAdvice(chance: number, when: string) {
  if (chance >= 70) return `${when} वर्षाको उच्च सम्भावना छ, छाता बोक्न नभुल्नुहोला।`
  if (chance >= 40) return `${when} वर्षा हुन सक्छ, छाता साथमा राख्नुहोला।`
  if (chance >= 20) return `${when} छिटपुट वर्षाको सम्भावना छ।`
  return `${when} वर्षाको सम्भावना कम छ।`
}

export function buildWeatherView(data: WeatherData, slot: WeatherSlot): WeatherView {
  const now = data.current.time
  const today = now.slice(0, 10)
  const todayIdx = Math.max(0, data.daily.findIndex((d) => d.date === today))
  const day = data.daily[todayIdx]
  const tomorrowDay = data.daily[todayIdx + 1] ?? null
  const hourAt = (t: string) => data.hourly.find((h) => h.time === t)
  const place = data.place.np

  // Hourly strip for the slot.
  const nextHour = `${now.slice(0, 13)}:00`
  const stripTimes =
    slot === 'morning'
      ? ['09:00', '12:00', '15:00', '18:00'].map((t) => `${today}T${t}`)
      : slot === 'afternoon'
        ? [2, 4, 6, 8].map((h) => addHours(nextHour, h))
        : [`${today}T21:00`, addHours(`${today}T21:00`, 3), addHours(`${today}T21:00`, 6), addHours(`${today}T21:00`, 9)]
  const strip: StripItem[] = stripTimes
    .map((t) => {
      const h = hourAt(t)
      if (!h) return null
      return {
        label: nepaliClock(t.slice(11, 16)),
        icon: describeCode(h.code).icon,
        isDay: h.isDay,
        temp: `${np(h.temp)}°`,
        rainChance: `${np(h.rainChance)}%`,
      }
    })
    .filter((x): x is StripItem => !!x)

  const remaining = data.hourly.filter((h) => h.time >= now && h.time.startsWith(today))
  const tonight = data.hourly.filter((h) => h.time >= now && h.time <= addHours(`${today}T06:00`, 24))

  const aqi = data.aqi ? aqiLabel(data.aqi.usAqi) : null
  const base = {
    slot,
    title: SLOT_INFO[slot].np,
    emoji: SLOT_INFO[slot].emoji,
    place,
    feelsLike: `${np(data.current.feelsLike)}°`,
    humidity: `${np(data.current.humidity)}%`,
    wind: `${np(data.current.windKmh)} किमी/घण्टा`,
    sunrise: nepaliClock(day.sunrise),
    sunset: nepaliClock(day.sunset),
    uv: np(day.uv),
    aqi: data.aqi ? np(data.aqi.usAqi) : '',
    aqiLabel: aqi?.np ?? '',
    strip,
  }

  if (slot === 'morning') {
    const cond = describeCode(day.code)
    const parts = [
      `आज ${place}मा ${cond.np} रहने देखिन्छ।`,
      `अधिकतम तापक्रम ${np(day.high)}° र न्यूनतम ${np(day.low)}° सेल्सियस रहने अनुमान छ।`,
      rainAdvice(day.rainChance, 'आज'),
    ]
    if (day.uv >= 8) parts.push('घाम कडा हुने भएकाले टाउको छोपेर मात्र बाहिर निस्कनुहोला।')
    return {
      ...base,
      date: today,
      icon: cond.icon,
      isDay: true,
      condition: cond.np,
      temp: `${np(data.current.temp)}°`,
      high: `${np(day.high)}°`,
      low: `${np(day.low)}°`,
      rainChance: `${np(day.rainChance)}%`,
      summary: parts.join(' '),
      tomorrow: null,
    }
  }

  if (slot === 'afternoon') {
    const cond = describeCode(data.current.code)
    const restChance = remaining.length ? Math.max(...remaining.map((h) => h.rainChance)) : day.rainChance
    const parts = [
      `अहिले ${place}मा ${cond.np} छ र तापक्रम ${np(data.current.temp)}° सेल्सियस छ (महसुस ${np(data.current.feelsLike)}°)।`,
      `आर्द्रता ${np(data.current.humidity)}% छ।`,
      rainAdvice(restChance, 'बाँकी दिनमा'),
    ]
    return {
      ...base,
      date: today,
      icon: cond.icon,
      isDay: data.current.isDay,
      condition: cond.np,
      temp: `${np(data.current.temp)}°`,
      high: `${np(day.high)}°`,
      low: `${np(day.low)}°`,
      rainChance: `${np(restChance)}%`,
      summary: parts.join(' '),
      tomorrow: null,
    }
  }

  // Evening: tonight + tomorrow
  const cond = describeCode(data.current.code)
  const tonightLow = tonight.length ? Math.min(...tonight.map((h) => h.temp)) : day.low
  const tonightChance = tonight.length ? Math.max(...tonight.map((h) => h.rainChance)) : 0
  const tom = tomorrowDay ? describeCode(tomorrowDay.code) : null
  const parts = [`आज राति ${place}मा न्यूनतम तापक्रम ${np(tonightLow)}° सेल्सियससम्म झर्ने अनुमान छ।`, rainAdvice(tonightChance, 'राति')]
  if (tomorrowDay && tom) {
    parts.push(`भोलि ${tom.np} रहने देखिन्छ, अधिकतम ${np(tomorrowDay.high)}° र न्यूनतम ${np(tomorrowDay.low)}°।`)
    if (tomorrowDay.rainChance >= 40) parts.push(rainAdvice(tomorrowDay.rainChance, 'भोलि'))
  }
  return {
    ...base,
    date: today,
    icon: cond.icon,
    isDay: data.current.isDay,
    condition: cond.np,
    temp: `${np(data.current.temp)}°`,
    high: `${np(day.high)}°`,
    low: `${np(tonightLow)}°`,
    rainChance: `${np(tonightChance)}%`,
    summary: parts.join(' '),
    tomorrow:
      tomorrowDay && tom
        ? { condition: tom.np, high: `${np(tomorrowDay.high)}°`, low: `${np(tomorrowDay.low)}°`, rainChance: `${np(tomorrowDay.rainChance)}%` }
        : null,
  }
}

/** Template variables for a weather view (merged with the base date/brand vars). */
export function weatherVars(v: WeatherView): Record<string, string> {
  return {
    place: v.place,
    slot_title: v.title,
    condition: v.condition,
    temp: v.temp,
    feels_like: v.feelsLike,
    high: v.high,
    low: v.low,
    rain_chance: v.rainChance,
    humidity: v.humidity,
    wind: v.wind,
    sunrise: v.sunrise,
    sunset: v.sunset,
    uv: v.uv,
    aqi: v.aqi,
    aqi_label: v.aqiLabel,
    summary: v.summary,
    tomorrow_condition: v.tomorrow?.condition ?? '',
    tomorrow_high: v.tomorrow?.high ?? '',
    tomorrow_low: v.tomorrow?.low ?? '',
    tomorrow_rain_chance: v.tomorrow?.rainChance ?? '',
  }
}

/** Detail lines for captions. */
export function weatherDetailLines(v: WeatherView): string[] {
  const lines = [
    `🌡️ तापक्रम: ${v.temp} (महसुस ${v.feelsLike})`,
    v.slot === 'evening' ? `🌙 आज रातिको न्यूनतम: ${v.low}` : `📈 अधिकतम / न्यूनतम: ${v.high} / ${v.low}`,
    `🌧️ वर्षाको सम्भावना: ${v.rainChance}`,
    `💧 आर्द्रता: ${v.humidity}`,
    `💨 हावा: ${v.wind}`,
  ]
  if (v.slot === 'morning') lines.push(`🌅 सूर्योदय: ${v.sunrise} · 🌇 सूर्यास्त: ${v.sunset}`, `🔆 पराबैजनी (UV) सूचकांक: ${v.uv}`)
  if (v.slot === 'evening' && v.tomorrow)
    lines.push(`📅 भोलि: ${v.tomorrow.condition}, ${v.tomorrow.high} / ${v.tomorrow.low}, वर्षा ${v.tomorrow.rainChance}`)
  if (v.aqi) lines.push(`😷 वायु गुणस्तर (AQI): ${v.aqi} — ${v.aqiLabel}`)
  return lines
}
