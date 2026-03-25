import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'database.sqlite')

export const db = new Database(DB_PATH)

export function initDatabase(): void {

  // ── api_keys ──────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id            TEXT PRIMARY KEY,
      key           TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      is_active     INTEGER DEFAULT 1,
      requests      INTEGER DEFAULT 0,
      expires_at    TEXT DEFAULT NULL,
      custom_schema TEXT DEFAULT NULL,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `)

  // ── request_logs ──────────────────────────────────────────────────────────
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

  // ── models ────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      model_id   TEXT UNIQUE NOT NULL,
      is_active  INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // seed default model if table is empty
  const count = (db.prepare('SELECT COUNT(*) as c FROM models').get() as any).c
  if (count === 0) {
    db.prepare(`
      INSERT INTO models (id, name, model_id, is_active)
      VALUES ('default', 'LLaMA 3.1 8B Instant', 'llama-3.1-8b-instant', 1)
    `).run()
  }

  // migrations for existing databases
  const migrations = [
    `ALTER TABLE api_keys ADD COLUMN expires_at    TEXT DEFAULT NULL`,
    `ALTER TABLE api_keys ADD COLUMN custom_schema TEXT DEFAULT NULL`,
  ]
  for (const sql of migrations) {
    try { db.exec(sql) } catch { /* column already exists */ }
  }

  console.log('Database initialized')
}

// get the currently active model_id — fallback to default if none set
export function getActiveModelId(): string {
  const DEFAULT = 'llama-3.1-8b-instant'
  try {
    const row = db.prepare(
      `SELECT model_id FROM models WHERE is_active = 1 LIMIT 1`
    ).get() as any
    return row?.model_id ?? DEFAULT
  } catch {
    return DEFAULT
  }
}