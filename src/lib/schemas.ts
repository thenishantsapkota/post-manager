import { z } from 'zod'
import { RASHIFAL_PERIODS, THEME_KEYS } from './types'

const num = z.number().finite()
const color = z.string().max(64)

const base = {
  id: z.string().min(1).max(32),
  name: z.string().max(80),
  x: num,
  y: num,
  w: num.positive(),
  h: num.positive(),
  rotation: num.min(-360).max(360),
  opacity: num.min(0).max(1),
  hidden: z.boolean().optional(),
}

export const textLayerSchema = z.object({
  ...base,
  type: z.literal('text'),
  text: z.string().max(5000),
  fontSize: num.min(6).max(600),
  minFontSize: num.min(6).max(600),
  weight: z.union([z.literal(400), z.literal(700), z.literal(800)]),
  color,
  align: z.enum(['left', 'center', 'right']),
  vAlign: z.enum(['top', 'middle', 'bottom']),
  lineHeight: num.min(0.8).max(3),
  shadow: z.boolean(),
  strokeColor: color,
  strokeWidth: num.min(0).max(40),
  bgColor: color,
  bgRadius: num.min(0),
  padding: num.min(0),
})

export const imageLayerSchema = z.object({
  ...base,
  type: z.literal('image'),
  source: z.enum(['logo', 'slot', 'media']),
  slot: z.string().max(40).regex(/^[a-zA-Z0-9_]*$/),
  mediaId: z.string().max(32),
  fit: z.enum(['cover', 'contain']),
  radius: num.min(0),
  circle: z.boolean(),
  borderColor: color,
  borderWidth: num.min(0).max(80),
})

export const shapeLayerSchema = z.object({
  ...base,
  type: z.literal('shape'),
  fill: color,
  radius: num.min(0),
  strokeColor: color,
  strokeWidth: num.min(0).max(80),
})

export const layerSchema = z.discriminatedUnion('type', [textLayerSchema, imageLayerSchema, shapeLayerSchema])

export const templateDataSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['general', 'rashifal_sign', 'rashifal_cover']),
  width: z.number().int().min(100).max(4000),
  height: z.number().int().min(100).max(4000),
  backgroundMediaId: z.string().max(32).nullable(),
  backgroundColor: color,
  signBackgrounds: z.record(z.string(), z.string().max(32)),
  layers: z.array(layerSchema).max(60),
})

const stringMap = z.record(z.string().max(40), z.string().max(5000))

export const templateInputSchema = z.object({
  vars: stringMap,
  slots: z.record(z.string().max(40), z.string().max(32)),
  signKey: z.string().optional(),
})

export const cardSpecSchema = z.object({
  templateId: z.string().max(32).nullable(),
  theme: z.enum(THEME_KEYS),
  vars: stringMap,
  slots: z.record(z.string().max(40), z.string().max(32)),
})

export const imageEditsSchema = z.object({
  rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  flipH: z.boolean(),
  flipV: z.boolean(),
  crop: z
    .object({ x: num.min(0).max(1), y: num.min(0).max(1), w: num.min(0.01).max(1), h: num.min(0.01).max(1) })
    .optional(),
  brightness: num.min(0).max(300),
  contrast: num.min(0).max(300),
  saturation: num.min(0).max(300),
  blur: num.min(0).max(40),
  grayscale: z.boolean(),
  sepia: z.boolean(),
  maxSize: z.number().int().min(0).max(4096),
  watermark: z
    .object({
      position: z.enum(['tl', 'tr', 'bl', 'br', 'center']),
      size: num.min(0.05).max(0.6),
      opacity: num.min(0.05).max(1),
    })
    .optional(),
})

export const automationConfigSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('rashifal'),
    period: z.enum(RASHIFAL_PERIODS),
    format: z.enum(['album', 'cover']),
  }),
  z.object({
    kind: z.literal('library'),
    collection: z.string().trim().min(1).max(60),
    order: z.enum(['sequential', 'random']),
  }),
])

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
