import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'database.sqlite')

export const db = new Database(DB_PATH)

// ── Active model shape ────────────────────────────────────────────────────────
export interface ActiveModel {
  model_id:    string
  token_limit: number | null   // per-request token ceiling; null = no known limit
}

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
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      model_id    TEXT UNIQUE NOT NULL,
      is_active   INTEGER DEFAULT 0,
      token_limit INTEGER DEFAULT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `)

  // seed default model if table is empty
  const count = (db.prepare('SELECT COUNT(*) as c FROM models').get() as any).c
  if (count === 0) {
    db.prepare(`
      INSERT INTO models (id, name, model_id, is_active, token_limit)
      VALUES ('default', 'LLaMA 3.1 8B Instant', 'llama-3.1-8b-instant', 1, 6000)
    `).run()
  }

  // ── migrations for existing databases ────────────────────────────────────
  const migrations = [
    `ALTER TABLE api_keys ADD COLUMN expires_at    TEXT DEFAULT NULL`,
    `ALTER TABLE api_keys ADD COLUMN custom_schema TEXT DEFAULT NULL`,
    // add token_limit to models for existing deployments
    `ALTER TABLE models   ADD COLUMN token_limit   INTEGER DEFAULT NULL`,
  ]
  for (const sql of migrations) {
    try { db.exec(sql) } catch { /* column already exists — safe to ignore */ }
  }

  // backfill token_limit for the default model on existing deployments
  db.prepare(`
    UPDATE models SET token_limit = 6000
    WHERE model_id = 'llama-3.1-8b-instant' AND token_limit IS NULL
  `).run()

  console.log('Database initialized')
}

// ── getActiveModel — returns model_id + token_limit for the active model ─────
export function getActiveModel(): ActiveModel {
  const DEFAULT: ActiveModel = { model_id: 'llama-3.1-8b-instant', token_limit: 6000 }
  try {
    const row = db.prepare(
      `SELECT model_id, token_limit FROM models WHERE is_active = 1 LIMIT 1`
    ).get() as any
    if (!row) return DEFAULT
    return {
      model_id:    row.model_id,
      token_limit: typeof row.token_limit === 'number' ? row.token_limit : null
    }
  } catch {
    return DEFAULT
  }
}

// ── getActiveModelId — kept for backward compatibility ───────────────────────
export function getActiveModelId(): string {
  return getActiveModel().model_id
}