import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'database.sqlite')

export const db = new Database(DB_PATH)

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id          TEXT PRIMARY KEY,
      key         TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      is_active   INTEGER DEFAULT 1,
      requests    INTEGER DEFAULT 0,
      expires_at  TEXT DEFAULT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `)

  // add expires_at column if it doesn't exist (migration for existing DBs)
  try {
    db.exec(`ALTER TABLE api_keys ADD COLUMN expires_at TEXT DEFAULT NULL`)
  } catch {
    // column already exists — safe to ignore
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id          TEXT PRIMARY KEY,
      api_key_id  TEXT,
      query       TEXT NOT NULL,
      keys_found  INTEGER,
      latency_ms  INTEGER,
      status      INTEGER,
      error       TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `)

  console.log('Database initialized')
}