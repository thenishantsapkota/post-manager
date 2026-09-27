import path from 'node:path'

// Read lazily so values are resolved at call time (after .env is loaded).
export const config = {
  get dataDir() {
    return path.resolve(process.env.DATA_DIR ?? './data')
  },
  get databaseUrl() {
    return process.env.DATABASE_URL ?? `file:${path.join(this.dataDir, 'app.db')}`
  },
  get graphVersion() {
    return process.env.FB_GRAPH_VERSION ?? 'v23.0'
  },
  get adminPassword() {
    return process.env.ADMIN_PASSWORD ?? ''
  },
  get sessionSecret() {
    return process.env.SESSION_SECRET ?? ''
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? ''
  },
  get schedulerEnabled() {
    return process.env.SCHEDULER_ENABLED !== 'false'
  },
  get rashifalApiUrl() {
    return process.env.RASHIFAL_API_URL ?? 'https://nepalipatro.com.np/rashifal/getv5/type/dwmy'
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production'
  },
}
