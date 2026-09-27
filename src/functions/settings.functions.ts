import { createServerFn } from '@tanstack/react-start'
import { and, count, eq, gte } from 'drizzle-orm'
import { z } from 'zod'
import { authMiddleware } from './middleware'
import { listAutomations } from '#/server/automations'
import { config } from '#/server/config'
import { getDb, schema } from '#/server/db'
import { exchangeForPageTokens, getPage } from '#/server/facebook'
import { upcomingPosts } from '#/server/posts'
import { currentSet } from '#/server/rashifal'
import { getSettings, logActivity, recentActivity, saveSettings } from '#/server/settings'

function mask(token: string) {
  return token ? `${token.slice(0, 6)}…${token.slice(-4)}` : ''
}

export const getSettingsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const s = await getSettings()
    // Never send the page token back to the browser.
    const { fbPageToken, ...rest } = s
    return {
      ...rest,
      hasToken: Boolean(fbPageToken),
      tokenPreview: mask(fbPageToken),
      schedulerEnabled: config.schedulerEnabled,
      cronConfigured: Boolean(config.cronSecret),
      graphVersion: config.graphVersion,
    }
  })

export const saveSettingsFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      brandName: z.string().trim().min(1).max(60).optional(),
      brandHandle: z.string().trim().max(80).optional(),
      logoMediaId: z.string().max(32).optional(),
      hashtags: z.string().max(500).optional(),
      rashifalCaption: z.string().max(5000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await saveSettings(data)
    return { ok: true }
  })

/** Verify a page id + token against Facebook, then store them. */
export const connectPageFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ pageId: z.string().trim().min(1).max(40), token: z.string().trim().min(20).max(1000) }))
  .handler(async ({ data }) => {
    const page = await getPage(data.pageId, data.token)
    await saveSettings({ fbPageId: page.id, fbPageToken: data.token, fbPageName: page.name })
    await logActivity('success', `Connected Facebook page “${page.name}”`)
    return { name: page.name, id: page.id }
  })

/** Exchange a user token for page tokens (App ID/secret are used once, not stored). */
export const exchangeTokenFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      appId: z.string().trim().min(3).max(40),
      appSecret: z.string().trim().min(10).max(100),
      userToken: z.string().trim().min(20).max(1000),
    }),
  )
  .handler(async ({ data }) => {
    const res = await exchangeForPageTokens(data)
    const required = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts']
    return {
      userName: res.userName,
      missingPermissions: required.filter((p) => !res.granted.includes(p)),
      selectedPageIds: res.selectedPageIds,
      pages: res.pages.map((p) => ({
        id: p.id,
        name: p.name,
        token: p.access_token,
        canPost: !p.tasks || p.tasks.includes('CREATE_CONTENT') || p.tasks.includes('MANAGE'),
      })),
    }
  })

export const testConnectionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async () => {
    const s = await getSettings()
    if (!s.fbPageId || !s.fbPageToken) throw new Error('No page connected yet.')
    const page = await getPage(s.fbPageId, s.fbPageToken)
    return {
      name: page.name,
      followers: page.followers_count ?? page.fan_count ?? null,
      picture: page.picture?.data?.url ?? null,
      link: page.link ?? null,
    }
  })

export const disconnectPageFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async () => {
    await saveSettings({ fbPageId: '', fbPageToken: '', fbPageName: '' })
    await logActivity('info', 'Disconnected the Facebook page')
    return { ok: true }
  })

export const getDashboardFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const db = await getDb()
    const s = await getSettings()
    const weekAgo = Date.now() - 7 * 86400_000
    const [published] = await db
      .select({ n: count() })
      .from(schema.posts)
      .where(and(eq(schema.posts.status, 'published'), gte(schema.posts.publishedAt, weekAgo)))
    const [scheduled] = await db.select({ n: count() }).from(schema.posts).where(eq(schema.posts.status, 'scheduled'))
    const [failed] = await db.select({ n: count() }).from(schema.posts).where(eq(schema.posts.status, 'failed'))
    const automations = await listAutomations()
    const today = await currentSet('D')
    return {
      pageName: s.fbPageName,
      connected: Boolean(s.fbPageId && s.fbPageToken),
      stats: {
        publishedWeek: published.n,
        scheduled: scheduled.n,
        failed: failed.n,
        activeAutomations: automations.filter((a) => a.enabled).length,
      },
      upcoming: await upcomingPosts(6),
      automations: automations.filter((a) => a.enabled).slice(0, 6),
      todayRashifal: today ? { id: today.id, endDate: today.endDate } : null,
      activity: await recentActivity(12),
      schedulerEnabled: config.schedulerEnabled,
    }
  })
