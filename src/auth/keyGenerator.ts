import { randomUUID } from 'crypto'
import { db }         from '../db/database'

const DEFAULT_EXPIRY_DAYS = 30
const DEFAULT_RPM         = 60

export interface ApiKey {
  id:             string
  key:            string
  name:           string
  is_active:      number
  requests:       number
  expires_at:     string | null
  custom_schema:  string | null
  rate_limit_rpm: number
  created_at:     string
}

function generateKeyString(): string {
  return `sgy_${randomUUID().replace(/-/g, '')}`
}

function expiryDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

// ── Create ────────────────────────────────────────────────────────────────────
export function createApiKey(
  name:           string,
  expiresInDays:  number = DEFAULT_EXPIRY_DAYS,
  rateLimitRpm:   number = DEFAULT_RPM
): ApiKey {
  const id         = randomUUID()
  const key        = generateKeyString()
  const expires_at = expiryDate(expiresInDays)
  const rpm        = rateLimitRpm > 0 ? rateLimitRpm : DEFAULT_RPM

  db.prepare(`
    INSERT INTO api_keys (id, key, name, expires_at, rate_limit_rpm)
    VALUES (@id, @key, @name, @expires_at, @rpm)
  `).run({ id, key, name, expires_at, rpm })

  return db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as ApiKey
}

// ── Validate ──────────────────────────────────────────────────────────────────
export function validateApiKey(key: string): ApiKey | null {
  const record = db.prepare(`
    SELECT * FROM api_keys WHERE key = ? AND is_active = 1
  `).get(key) as ApiKey | undefined

  if (!record) return null

  if (record.expires_at) {
    const expired = new Date(record.expires_at) < new Date()
    if (expired) {
      db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(record.id)
      return null
    }
  }

  db.prepare('UPDATE api_keys SET requests = requests + 1 WHERE key = ?').run(key)
  return record
}

// ── Revoke ────────────────────────────────────────────────────────────────────
export function revokeApiKey(id: string): boolean {
  return db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(id).changes > 0
}

// ── Update expiry ──────────────────────────────────────────────────────────────
export function updateKeyExpiry(id: string, expiresInDays: number): boolean {
  return db.prepare(`
    UPDATE api_keys SET expires_at = ?, is_active = 1 WHERE id = ?
  `).run(expiryDate(expiresInDays), id).changes > 0
}

// ── Update rate limit ─────────────────────────────────────────────────────────
export function updateRateLimit(id: string, rpm: number): boolean {
  if (rpm < 1) return false
  return db.prepare(`
    UPDATE api_keys SET rate_limit_rpm = ? WHERE id = ?
  `).run(rpm, id).changes > 0
}

// ── Permanent delete (with logs) ──────────────────────────────────────────────
export function deleteApiKey(id: string): boolean {
  return db.transaction(() => {
    db.prepare('DELETE FROM request_logs WHERE api_key_id = ?').run(id)
    return db.prepare('DELETE FROM api_keys WHERE id = ?').run(id).changes > 0
  })()
}

// ── Delete custom schema ──────────────────────────────────────────────────────
export function deleteCustomSchema(id: string): boolean {
  return db.prepare('UPDATE api_keys SET custom_schema = NULL WHERE id = ?').run(id).changes > 0
}

// ── List all ──────────────────────────────────────────────────────────────────
export function listApiKeys(): ApiKey[] {
  return db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC').all() as ApiKey[]
}