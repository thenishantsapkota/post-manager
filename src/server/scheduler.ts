import { runDueAutomations } from './automations'
import { config } from './config'
import { publishDuePosts, recoverStuckPosts } from './posts'
import { syncRashifalQuietly } from './rashifal'

const INTERVAL_MS = 30_000
/** Background refresh of Nepali Patro data (automations also fetch on demand). */
const SYNC_EVERY_MS = 60 * 60_000

let lastSync = 0

let running: Promise<void> | null = null

/** One scheduler pass. Safe to call from the timer and from /api/cron. */
export function tick(): Promise<void> {
  running ??= (async () => {
    try {
      if (Date.now() - lastSync > SYNC_EVERY_MS) {
        lastSync = Date.now()
        await syncRashifalQuietly()
      }
      await runDueAutomations()
      await publishDuePosts()
    } catch (err) {
      console.error('[damak-banda] scheduler tick failed', err)
    } finally {
      running = null
    }
  })()
  return running
}

const g = globalThis as unknown as { __damakScheduler?: NodeJS.Timeout }

export function startScheduler() {
  if (!config.schedulerEnabled || g.__damakScheduler) return
  g.__damakScheduler = setInterval(() => void tick(), INTERVAL_MS)
  g.__damakScheduler.unref?.()
  setTimeout(() => {
    recoverStuckPosts()
      .catch((err) => console.error('[damak-banda] recovery failed', err))
      .finally(() => void tick())
  }, 2_000)
  console.log(`[damak-banda] scheduler started (every ${INTERVAL_MS / 1000}s)`)
}
