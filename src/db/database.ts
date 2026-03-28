import Database from 'better-sqlite3'
import path     from 'path'

const DB_PATH = path.join(process.cwd(), 'database.sqlite')

export const db = new Database(DB_PATH)

// ── Active model shape ────────────────────────────────────────────────────────
export interface ActiveModel {
  model_id:    string
  token_limit: number | null
}

export function initDatabase(): void {

  // ── api_keys ──────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id              TEXT PRIMARY KEY,
      key             TEXT UNIQUE NOT NULL,
      name            TEXT NOT NULL,
      is_active       INTEGER DEFAULT 1,
      requests        INTEGER DEFAULT 0,
      expires_at      TEXT DEFAULT NULL,
      custom_schema   TEXT DEFAULT NULL,
      rate_limit_rpm  INTEGER DEFAULT 60,
      created_at      TEXT DEFAULT (datetime('now'))
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
      cache_hit   INTEGER DEFAULT 0,
      result_keys TEXT DEFAULT NULL,
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

  // ── query_cache ────────────────────────────────────────────────────────────
  // Caches query+schema hash → parsed result. 7-day TTL. Only non-empty results
  // are stored so suggestions are never blocked by stale cache entries.
  db.exec(`
    CREATE TABLE IF NOT EXISTS query_cache (
      query_hash  TEXT PRIMARY KEY,
      result_json TEXT NOT NULL,
      schema_type TEXT NOT NULL DEFAULT 'builtin',
      hits        INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      last_hit_at TEXT DEFAULT (datetime('now')),
      expires_at  TEXT NOT NULL
    )
  `)

  // ── Indexes ────────────────────────────────────────────────────────────────
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cache_expires ON query_cache (expires_at)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_key      ON request_logs (api_key_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_created  ON request_logs (created_at)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_status   ON request_logs (status)`)

  // ── Seed default model ────────────────────────────────────────────────────
  const count = (db.prepare('SELECT COUNT(*) as c FROM models').get() as any).c
  if (count === 0) {
    db.prepare(`
      INSERT INTO models (id, name, model_id, is_active, token_limit)
      VALUES ('default', 'LLaMA 3.1 8B Instant', 'llama-3.1-8b-instant', 1, 6000)
    `).run()
  }

  // ── Migrations for existing databases ─────────────────────────────────────
  const migrations = [
    `ALTER TABLE api_keys    ADD COLUMN expires_at     TEXT    DEFAULT NULL`,
    `ALTER TABLE api_keys    ADD COLUMN custom_schema  TEXT    DEFAULT NULL`,
    `ALTER TABLE api_keys    ADD COLUMN rate_limit_rpm INTEGER DEFAULT 60`,
    `ALTER TABLE request_logs ADD COLUMN cache_hit     INTEGER DEFAULT 0`,
    `ALTER TABLE request_logs ADD COLUMN result_keys   TEXT    DEFAULT NULL`,
    `ALTER TABLE models       ADD COLUMN token_limit   INTEGER DEFAULT NULL`,
  ]
  for (const sql of migrations) {
    try { db.exec(sql) } catch { /* column already exists — safe to ignore */ }
  }

  // Backfill token_limit for the default model on existing deployments
  db.prepare(`
    UPDATE models SET token_limit = 6000
    WHERE model_id = 'llama-3.1-8b-instant' AND token_limit IS NULL
  `).run()

  // ── Prepare cache statements AFTER tables are guaranteed to exist ──────────
  // Must be called here — not at module load time — because better-sqlite3
  // compiles the SQL immediately on db.prepare(), and the query_cache table
  // won't exist yet when the module is first imported.
  _initCacheStatements()

  console.log('Database initialized')
}

// ── getActiveModel ─────────────────────────────────────────────────────────────
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

// Kept for backward compatibility
export function getActiveModelId(): string {
  return getActiveModel().model_id
}

// ── Cache helpers ──────────────────────────────────────────────────────────────

const CACHE_TTL_DAYS = 7

function futureDateStr(days: number): string {
  return new Date(Date.now() + days * 86400000)
    .toISOString().slice(0, 19).replace('T', ' ')
}

// Lazy statement holders — null until _initCacheStatements() is called from
// initDatabase(). Keeps db.prepare() calls out of module scope entirely.
// Typed as Statement<unknown[]> so .run() accepts any number of bind params.
import type { Statement } from 'better-sqlite3'
type Stmt = Statement<unknown[]>
let stmtGetCache:    Stmt | null = null
let stmtIncrHits:    Stmt | null = null
let stmtUpsertCache: Stmt | null = null
let stmtCleanCache:  Stmt | null = null

function _initCacheStatements(): void {
  stmtGetCache    = db.prepare(
    `SELECT result_json FROM query_cache WHERE query_hash = ? AND expires_at > datetime('now')`
  )
  stmtIncrHits    = db.prepare(
    `UPDATE query_cache SET hits = hits + 1, last_hit_at = datetime('now') WHERE query_hash = ?`
  )
  stmtUpsertCache = db.prepare(`
    INSERT OR REPLACE INTO query_cache (query_hash, result_json, schema_type, expires_at)
    VALUES (?, ?, ?, ?)
  `)
  stmtCleanCache  = db.prepare(
    `DELETE FROM query_cache WHERE expires_at <= datetime('now')`
  )
}

export function getCacheEntry(hash: string): string | null {
  if (!stmtGetCache || !stmtIncrHits) return null
  const row = stmtGetCache.get(hash) as any
  if (!row) return null
  stmtIncrHits.run(hash)
  return row.result_json
}

export function setCacheEntry(
  hash:       string,
  resultJson: string,
  schemaType: 'builtin' | 'custom'
): void {
  if (!stmtUpsertCache || !stmtCleanCache) return
  stmtUpsertCache.run(hash, resultJson, schemaType, futureDateStr(CACHE_TTL_DAYS))
  // Probabilistic housekeeping — cleans expired rows ~1% of writes, no cron needed
  if (Math.random() < 0.01) stmtCleanCache.run()
}

export function clearAllCache(): number {
  return db.prepare('DELETE FROM query_cache').run().changes
}

export function getCacheStats(): { active: number; total_hits: number } {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as active, COALESCE(SUM(hits), 0) as total_hits
      FROM query_cache WHERE expires_at > datetime('now')
    `).get() as any
    return { active: row?.active ?? 0, total_hits: row?.total_hits ?? 0 }
  } catch {
    return { active: 0, total_hits: 0 }
  }
}