import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from 'lucide-react'
import type { WeatherIconKey } from '#/lib/weather'
import { cx } from './ui'

const DAY = { clear: Sun, mostly: CloudSun, partly: CloudSun } as const
const NIGHT = { clear: Moon, mostly: CloudMoon, partly: CloudMoon } as const
const OTHER = {
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  heavy: CloudRainWind,
  thunder: CloudLightning,
  snow: CloudSnow,
} as const

const TONE: Partial<Record<WeatherIconKey, string>> = {
  clear: 'text-amber-500',
  mostly: 'text-amber-500',
  partly: 'text-sky-500',
  rain: 'text-blue-500',
  heavy: 'text-blue-600',
  drizzle: 'text-blue-400',
  thunder: 'text-violet-500',
}

export function WeatherIcon({ icon, isDay, className }: { icon: WeatherIconKey; isDay: boolean; className?: string }) {
  const Icon =
    icon === 'clear' || icon === 'mostly' || icon === 'partly' ? (isDay ? DAY : NIGHT)[icon] : OTHER[icon]
  return <Icon className={cx('shrink-0', isDay || !(icon in NIGHT) ? TONE[icon] : 'text-indigo-400', className)} aria-hidden />
}
