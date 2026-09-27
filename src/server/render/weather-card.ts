import { createCanvas } from '@napi-rs/canvas'
import type { SKRSContext2D } from '@napi-rs/canvas'
import { describeDate } from '#/lib/nepali-date'
import type { WeatherIconKey, WeatherView } from '#/lib/weather'
import { H, W, drawBackground, drawFooter, drawHeader, ensureFonts, fitText, font, roundRect } from './canvas'
import type { Brand, Theme } from './canvas'
import { drawCredit } from './templates'
import type { RenderedImage } from './templates'
import { drawWeatherIcon } from './weather-icons'

export function weatherTheme(icon: WeatherIconKey, isDay: boolean, slot: WeatherView['slot']): Theme {
  if (icon === 'thunder') return { stops: ['#0f0a1e', '#312e81', '#6d28d9'], accent: '#fde68a' }
  if (icon === 'rain' || icon === 'heavy' || icon === 'drizzle') return { stops: ['#0f172a', '#1e3a8a', '#3b82f6'], accent: '#bfdbfe' }
  if (icon === 'fog') return { stops: ['#1f2937', '#4b5563', '#9ca3af'], accent: '#f3f4f6' }
  if (!isDay) return { stops: ['#020617', '#1e1b4b', '#3730a3'], accent: '#c7d2fe' }
  if (icon === 'cloudy' || icon === 'partly') return { stops: ['#1e293b', '#334155', '#64748b'], accent: '#e0f2fe' }
  if (slot === 'morning') return { stops: ['#7c2d12', '#ea580c', '#0ea5e9'], accent: '#fef3c7' }
  return { stops: ['#0c4a6e', '#0284c7', '#38bdf8'], accent: '#fef3c7' }
}

function chips(v: WeatherView): Array<[label: string, value: string]> {
  const aqi: [string, string] | null = v.aqi ? ['वायु गुणस्तर', `${v.aqi} · ${v.aqiLabel}`] : null
  if (v.slot === 'morning') {
    return [
      ['अधिकतम / न्यूनतम', `${v.high} / ${v.low}`],
      ['वर्षाको सम्भावना', v.rainChance],
      ['आर्द्रता', v.humidity],
      ['सूर्योदय', v.sunrise],
      ['सूर्यास्त', v.sunset],
      aqi ?? ['पराबैजनी (UV)', v.uv],
    ]
  }
  if (v.slot === 'afternoon') {
    return [
      ['अधिकतम / न्यूनतम', `${v.high} / ${v.low}`],
      ['बाँकी दिन वर्षा', v.rainChance],
      ['आर्द्रता', v.humidity],
      ['हावा', v.wind],
      ['पराबैजनी (UV)', v.uv],
      aqi ?? ['सूर्यास्त', v.sunset],
    ]
  }
  return [
    ['रातिको न्यूनतम', v.low],
    ['राति वर्षा', v.rainChance],
    ['आर्द्रता', v.humidity],
    ['भोलि', v.tomorrow?.condition ?? '—'],
    ['भोलि अधिकतम / न्यूनतम', v.tomorrow ? `${v.tomorrow.high} / ${v.tomorrow.low}` : '—'],
    aqi ?? ['भोलि वर्षा', v.tomorrow?.rainChance ?? '—'],
  ]
}

function fitLine(ctx: SKRSContext2D, text: string, maxWidth: number, size: number, weight: 400 | 700 | 800, min = 18) {
  let s = size
  ctx.font = font(s, weight)
  while (s > min && ctx.measureText(text).width > maxWidth) ctx.font = font((s -= 2), weight)
}

/** Small raindrop marker for rain-chance values. */
function drawDrop(ctx: SKRSContext2D, x: number, y: number, r: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y - r * 1.6)
  ctx.bezierCurveTo(x + r * 0.9, y - r * 0.4, x + r, y, x + r, y + r * 0.2)
  ctx.arc(x, y + r * 0.2, r, 0, Math.PI)
  ctx.bezierCurveTo(x - r, y, x - r * 0.9, y - r * 0.4, x, y - r * 1.6)
  ctx.fill()
  ctx.restore()
}

export async function renderWeatherCard(v: WeatherView, brand: Brand, credit: string): Promise<RenderedImage> {
  ensureFonts()
  const theme = weatherTheme(v.icon, v.isDay, v.slot)
  const d = describeDate(v.date)
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  drawBackground(ctx, theme)
  drawHeader(ctx, brand, v.title)

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = theme.accent
  ctx.font = font(36, 700)
  ctx.fillText(v.place, 72, 182)
  const placeW = ctx.measureText(v.place).width
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = font(32, 400)
  ctx.fillText(`· ${d.bs}, ${d.weekday}`, 72 + placeW + 14, 184)

  // Hero: icon + temperature
  drawWeatherIcon(ctx, v.icon, v.isDay, 70, 215, 310)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 20
  ctx.font = font(200, 800)
  ctx.fillText(v.temp, 745, 335)
  ctx.shadowBlur = 0
  fitLine(ctx, v.condition, 520, 48, 700, 30)
  ctx.fillText(v.condition, 745, 470)
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = font(30, 400)
  ctx.fillText(`महसुस ${v.feelsLike}`, 745, 522)

  // Summary
  const px = 72
  const pw = W - 144
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  roundRect(ctx, px, 565, pw, 170, 28)
  ctx.fill()
  const fit = fitText(ctx, v.summary, { width: pw - 72, height: 170 - 48 }, { max: 34, min: 22, weight: 400, lineHeight: 1.5 })
  ctx.font = font(fit.size, 400)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  let ty = 565 + (170 - fit.lines.length * fit.lineHeight) / 2 + fit.size * 0.1
  for (const line of fit.lines) {
    ctx.fillText(line, px + 36, ty)
    ty += fit.lineHeight
  }

  // Detail chips
  const gap = 16
  const cw = (pw - gap * 2) / 3
  const ch = 112
  chips(v).forEach(([label, value], i) => {
    const x = px + (i % 3) * (cw + gap)
    const y = 755 + Math.floor(i / 3) * (ch + gap)
    ctx.fillStyle = 'rgba(255,255,255,0.13)'
    roundRect(ctx, x, y, cw, ch, 22)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = theme.accent
    fitLine(ctx, label, cw - 24, 25, 700)
    ctx.fillText(label, x + cw / 2, y + 36)
    ctx.fillStyle = '#ffffff'
    fitLine(ctx, value, cw - 24, 36, 800)
    ctx.fillText(value, x + cw / 2, y + 78)
  })

  // Hourly strip
  if (v.strip.length) {
    const sy = 1012
    const sh = 168
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    roundRect(ctx, px, sy, pw, sh, 28)
    ctx.fill()
    const colW = pw / v.strip.length
    v.strip.forEach((item, i) => {
      const cx = px + colW * i + colW / 2
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      fitLine(ctx, item.label, colW - 16, 24, 700)
      ctx.fillText(item.label, cx, sy + 30)
      drawWeatherIcon(ctx, item.icon, item.isDay, cx - 34, sy + 48, 68)
      ctx.fillStyle = '#ffffff'
      ctx.font = font(32, 800)
      ctx.fillText(item.temp, cx - 30, sy + 138)
      drawDrop(ctx, cx + 12, sy + 139, 9, '#93c5fd')
      ctx.fillStyle = theme.accent
      ctx.font = font(24, 700)
      ctx.textAlign = 'left'
      ctx.fillText(item.rainChance, cx + 24, sy + 139)
    })
    if (v.strip.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 2
      for (let i = 1; i < v.strip.length; i++) {
        const x = px + colW * i
        ctx.beginPath()
        ctx.moveTo(x, sy + 24)
        ctx.lineTo(x, sy + sh - 24)
        ctx.stroke()
      }
    }
  }

  drawCredit(ctx, credit, 1208)
  drawFooter(ctx, brand, `${v.place} · ${d.bs}`)
  const data = await canvas.encode('jpeg', 92)
  return { data, mime: 'image/jpeg', width: W, height: H }
}
