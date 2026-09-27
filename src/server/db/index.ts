import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { config } from '../config'
import * as schema from './schema'

function create() {
  const url = config.databaseUrl
  if (url.startsWith('file:')) {
    fs.mkdirSync(path.dirname(url.slice('file:'.length)), { recursive: true })
  }
  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  })
  return drizzle(client, { schema })
}

export type DB = ReturnType<typeof create>

// Survive dev-server module reloads without opening extra connections.
const g = globalThis as unknown as { __dbReady?: Promise<DB> }

/** Returns the database, applying pending migrations on first use. */
export function getDb(): Promise<DB> {
  g.__dbReady ??= (async () => {
    const db = create()
    await db.run('PRAGMA journal_mode = WAL')
    await migrate(db, {
      migrationsFolder: path.resolve(process.env.MIGRATIONS_DIR ?? './drizzle'),
    })
    return db
  })().catch((err) => {
    g.__dbReady = undefined
    throw err
  })
  return g.__dbReady
}

export { schema }
