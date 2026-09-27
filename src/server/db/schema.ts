import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import type { AutomationConfig, CardSpec, Layer, RashifalPeriod, TemplateKind } from '../../lib/types'

// All timestamps are epoch milliseconds (UTC).

export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  width: integer('width'),
  height: integer('height'),
  bytes: integer('bytes').notNull(),
  kind: text('kind', { enum: ['upload', 'generated'] }).notNull(),
  label: text('label'),
  createdAt: integer('created_at').notNull(),
})

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    title: text('title'),
    caption: text('caption').notNull().default(''),
    mediaIds: text('media_ids', { mode: 'json' }).$type<string[]>().notNull(),
    status: text('status', {
      enum: ['draft', 'scheduled', 'publishing', 'published', 'failed'],
    }).notNull(),
    scheduledAt: integer('scheduled_at'),
    publishedAt: integer('published_at'),
    fbPostId: text('fb_post_id'),
    permalink: text('permalink'),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    source: text('source', { enum: ['manual', 'automation'] }).notNull(),
    automationId: text('automation_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('posts_status_scheduled').on(t.status, t.scheduledAt)],
)

export const automations = sqliteTable('automations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['rashifal', 'library'] }).notNull(),
  cron: text('cron').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  config: text('config', { mode: 'json' }).$type<AutomationConfig>().notNull(),
  nextRunAt: integer('next_run_at'),
  lastRunAt: integer('last_run_at'),
  lastStatus: text('last_status', { enum: ['ok', 'error', 'skipped'] }),
  lastMessage: text('last_message'),
  /** Rashifal: the set (period:endDate) this automation last posted, to avoid reposting. */
  lastSetKey: text('last_set_key'),
  /** Set while waiting for content to appear: the original slot time being retried. */
  pendingSlotAt: integer('pending_slot_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const libraryItems = sqliteTable(
  'library_items',
  {
    id: text('id').primaryKey(),
    collection: text('collection').notNull(),
    caption: text('caption').notNull().default(''),
    mediaId: text('media_id'),
    card: text('card', { mode: 'json' }).$type<CardSpec>(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    timesPosted: integer('times_posted').notNull().default(0),
    lastPostedAt: integer('last_posted_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('library_collection').on(t.collection)],
)

export const rashifalSets = sqliteTable(
  'rashifal_sets',
  {
    id: text('id').primaryKey(),
    period: text('period').$type<RashifalPeriod>().notNull(),
    /** Last day the set covers (Nepali Patro "todate"), YYYY-MM-DD. */
    endDate: text('end_date').notNull(),
    title: text('title').notNull(),
    author: text('author').notNull().default(''),
    /** sign key → text */
    entries: text('entries', { mode: 'json' }).$type<Record<string, string>>().notNull(),
    /** True once someone has edited the text by hand in this app. */
    edited: integer('edited', { mode: 'boolean' }).notNull().default(false),
    fetchedAt: integer('fetched_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [uniqueIndex('rashifal_period_end').on(t.period, t.endDate)],
)

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').$type<TemplateKind>().notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  backgroundMediaId: text('background_media_id'),
  backgroundColor: text('background_color').notNull().default('#1f2937'),
  signBackgrounds: text('sign_backgrounds', { mode: 'json' })
    .$type<Record<string, string>>()
    .notNull(),
  layers: text('layers', { mode: 'json' }).$type<Layer[]>().notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const activityLog = sqliteTable('activity_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  level: text('level', { enum: ['info', 'success', 'error'] }).notNull(),
  message: text('message').notNull(),
  createdAt: integer('created_at').notNull(),
})

export type Media = typeof media.$inferSelect
export type Post = typeof posts.$inferSelect
export type Automation = typeof automations.$inferSelect
export type LibraryItem = typeof libraryItems.$inferSelect
export type RashifalSet = typeof rashifalSets.$inferSelect
export type Template = typeof templates.$inferSelect
