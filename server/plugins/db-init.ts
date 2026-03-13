import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { resolve } from 'node:path'
import { getDb } from '../db'

export default defineNitroPlugin(() => {
  const db = getDb()
  migrate(db, { migrationsFolder: resolve('server/db/migrations') })
  console.log('[db] migrations applied')
})
