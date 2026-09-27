import { createCanvas } from '@napi-rs/canvas'
import type { Canvas, SKRSContext2D } from '@napi-rs/canvas'
import type { WeatherIconKey } from '#/lib/weather'

// Vector weather icons drawn on a 100×100 grid, scaled to `size`.

const SUN = '#fbbf24'
const SUN_GLOW = 'rgba(251,191,36,0.35)'
const MOON = '#fde68a'
const CLOUD = '#f8fafc'
const CLOUD_BACK = '#cbd5e1'
const CLOUD_DARK = '#94a3b8'
const RAIN = '#60a5fa'
const BOLT = '#facc15'

function sun(c: SKRSContext2D, x: number, y: number, r: number) {
  c.save()
  c.fillStyle = SUN_GLOW
  c.beginPath()
  c.arc(x, y, r * 1.45, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = SUN
  c.lineCap = 'round'
  c.lineWidth = r * 0.22
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    c.beginPath()
    c.moveTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3)
    c.lineTo(x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 1.7)
    c.stroke()
  }
  c.fillStyle = SUN
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

function moon(c: SKRSContext2D, x: number, y: number, r: number) {
  // Crescent: draw a disc, then cut an offset disc out of it on this layer.
  c.save()
  c.fillStyle = MOON
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
  c.globalCompositeOperation = 'destination-out'
  c.beginPath()
  c.arc(x + r * 0.55, y - r * 0.35, r * 0.85, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

function cloud(c: SKRSContext2D, ox: number, oy: number, w: number, fill: string) {
  const u = w / 100
  c.save()
  c.fillStyle = fill
  c.shadowColor = 'rgba(15,23,42,0.25)'
  c.shadowBlur = 6 * u
  c.shadowOffsetY = 3 * u
  c.beginPath()
  c.arc(ox + 30 * u, oy + 55 * u, 18 * u, 0, Math.PI * 2)
  c.arc(ox + 52 * u, oy + 42 * u, 25 * u, 0, Math.PI * 2)
  c.arc(ox + 74 * u, oy + 56 * u, 17 * u, 0, Math.PI * 2)
  c.roundRect(ox + 12 * u, oy + 52 * u, 76 * u, 22 * u, 11 * u)
  c.fill()
  c.restore()
}

function drops(c: SKRSContext2D, s: number, count: number, heavy = false) {
  c.save()
  c.strokeStyle = RAIN
  c.lineCap = 'round'
  c.lineWidth = s * (heavy ? 0.055 : 0.045)
  const xs = count === 2 ? [38, 60] : count === 3 ? [32, 50, 68] : [26, 42, 58, 74]
  xs.forEach((x, i) => {
    const y = 76 + (i % 2) * 6
    const len = heavy ? 18 : 12
    c.beginPath()
    c.moveTo((x / 100) * s, (y / 100) * s)
    c.lineTo(((x - 5) / 100) * s, ((y + len) / 100) * s)
    c.stroke()
  })
  c.restore()
}

function dots(c: SKRSContext2D, s: number) {
  c.save()
  c.fillStyle = RAIN
  for (const [x, y] of [[34, 82], [50, 88], [66, 82], [42, 95], [58, 95]]) {
    c.beginPath()
    c.arc((x / 100) * s, (y / 100) * s, s * 0.028, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
}

function bolt(c: SKRSContext2D, s: number) {
  const p = (x: number, y: number) => [(x / 100) * s, (y / 100) * s] as const
  c.save()
  c.fillStyle = BOLT
  c.beginPath()
  c.moveTo(...p(54, 62))
  c.lineTo(...p(40, 84))
  c.lineTo(...p(51, 84))
  c.lineTo(...p(45, 100))
  c.lineTo(...p(64, 76))
  c.lineTo(...p(53, 76))
  c.lineTo(...p(60, 62))
  c.closePath()
  c.fill()
  c.restore()
}

function fogLines(c: SKRSContext2D, s: number) {
  c.save()
  c.strokeStyle = CLOUD_BACK
  c.lineCap = 'round'
  c.lineWidth = s * 0.05
  for (const [x1, x2, y] of [[18, 70, 82], [30, 86, 92]]) {
    c.beginPath()
    c.moveTo((x1 / 100) * s, (y / 100) * s)
    c.lineTo((x2 / 100) * s, (y / 100) * s)
    c.stroke()
  }
  c.restore()
}

function flakes(c: SKRSContext2D, s: number) {
  c.save()
  c.strokeStyle = '#e0f2fe'
  c.lineCap = 'round'
  c.lineWidth = s * 0.03
  for (const [x, y] of [[32, 86], [52, 92], [70, 84]]) {
    const r = s * 0.05
    const cx = (x / 100) * s
    const cy = (y / 100) * s
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI
      c.beginPath()
      c.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r)
      c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      c.stroke()
    }
  }
  c.restore()
}

const cache = new Map<string, Canvas>()

/** Returns a transparent square canvas with the icon drawn on it. */
export function weatherIconCanvas(key: WeatherIconKey, isDay: boolean, size: number): Canvas {
  const id = `${key}:${isDay}:${Math.round(size)}`
  const hit = cache.get(id)
  if (hit) return hit
  const s = Math.round(size)
  const canvas = createCanvas(s, s)
  const c = canvas.getContext('2d')
  const orb = (x: number, y: number, r: number) => (isDay ? sun(c, x, y, r) : moon(c, x, y, r))

  switch (key) {
    case 'clear':
      orb(s * 0.5, s * 0.5, s * (isDay ? 0.24 : 0.3))
      break
    case 'mostly':
      orb(s * 0.45, s * 0.4, s * (isDay ? 0.2 : 0.24))
      cloud(c, s * 0.38, s * 0.42, s * 0.55, CLOUD)
      break
    case 'partly':
      orb(s * 0.62, s * 0.32, s * (isDay ? 0.18 : 0.21))
      cloud(c, s * 0.06, s * 0.18, s * 0.86, CLOUD)
      break
    case 'cloudy':
      cloud(c, s * 0.26, s * 0.02, s * 0.7, CLOUD_BACK)
      cloud(c, s * 0.04, s * 0.18, s * 0.86, CLOUD)
      break
    case 'fog':
      cloud(c, s * 0.08, s * 0.0, s * 0.84, CLOUD)
      fogLines(c, s)
      break
    case 'drizzle':
      cloud(c, s * 0.08, s * 0.0, s * 0.84, CLOUD)
      dots(c, s)
      break
    case 'rain':
      cloud(c, s * 0.08, s * 0.0, s * 0.84, CLOUD)
      drops(c, s, 3)
      break
    case 'heavy':
      cloud(c, s * 0.08, s * 0.0, s * 0.84, CLOUD_DARK)
      drops(c, s, 4, true)
      break
    case 'thunder':
      cloud(c, s * 0.08, s * -0.04, s * 0.84, CLOUD_DARK)
      bolt(c, s)
      drops(c, s, 2)
      break
    case 'snow':
      cloud(c, s * 0.08, s * 0.0, s * 0.84, CLOUD)
      flakes(c, s)
      break
  }
  if (cache.size > 100) cache.clear()
  cache.set(id, canvas)
  return canvas
}

export function drawWeatherIcon(
  ctx: SKRSContext2D,
  key: WeatherIconKey,
  isDay: boolean,
  x: number,
  y: number,
  size: number,
) {
  ctx.drawImage(weatherIconCanvas(key, isDay, size), x, y, size, size)
}
