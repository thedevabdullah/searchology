import { randomUUID } from 'crypto'
import { db } from '../db/database'

const DEFAULT_EXPIRY_DAYS = 30

interface ApiKey {
  id:         string
  key:        string
  name:       string
  is_active:  number
  requests:   number
  expires_at: string | null
  created_at: string
}

function generateKeyString(): string {
  const raw = randomUUID().replace(/-/g, '')
  return `sgy_${raw}`
}

function expiryDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

// create a new API key — defaults to 30 days expiry, admin can pass custom days
export function createApiKey(name: string, expiresInDays: number = DEFAULT_EXPIRY_DAYS): ApiKey {
  const id         = randomUUID()
  const key        = generateKeyString()
  const expires_at = expiryDate(expiresInDays)

  db.prepare(`
    INSERT INTO api_keys (id, key, name, expires_at)
    VALUES (@id, @key, @name, @expires_at)
  `).run({ id, key, name, expires_at })

  return db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as ApiKey
}

// validate a key — checks active + not expired
export function validateApiKey(key: string): ApiKey | null {
  const record = db.prepare(`
    SELECT * FROM api_keys
    WHERE key = ? AND is_active = 1
  `).get(key) as ApiKey | undefined

  if (!record) return null

  // check expiry
  if (record.expires_at) {
    const expired = new Date(record.expires_at) < new Date()
    if (expired) {
      // auto-deactivate expired key
      db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(record.id)
      return null
    }
  }

  // increment request count
  db.prepare('UPDATE api_keys SET requests = requests + 1 WHERE key = ?').run(key)

  return record
}

// revoke a key
export function revokeApiKey(id: string): boolean {
  const result = db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(id)
  return result.changes > 0
}

// update expiry on an existing key
export function updateKeyExpiry(id: string, expiresInDays: number): boolean {
  const expires_at = expiryDate(expiresInDays)
  const result = db.prepare(`
    UPDATE api_keys SET expires_at = ?, is_active = 1 WHERE id = ?
  `).run(expires_at, id)
  return result.changes > 0
}

// list all keys
export function listApiKeys(): ApiKey[] {
  return db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC').all() as ApiKey[]
}