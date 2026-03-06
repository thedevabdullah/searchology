import { randomUUID } from 'crypto'
import { db } from '../db/database'

// shape of a key record coming out of the database
interface ApiKey {
  id:         string
  key:        string
  name:       string
  is_active:  number
  requests:   number
  created_at: string
}


function generateKeyString(): string {
  const raw = randomUUID().replace(/-/g, '')  // remove dashes from uuid
  return `sgy_${raw}`
}

// create a new API key for a client
export function createApiKey(name: string): ApiKey {
  const id  = randomUUID()
  const key = generateKeyString()

  const stmt = db.prepare(`
    INSERT INTO api_keys (id, key, name)
    VALUES (@id, @key, @name)
  `)

  stmt.run({ id, key, name })

  // return the full record
  return db.prepare('SELECT * FROM api_keys WHERE id = ?')
           .get(id) as ApiKey
}

// validate a key — returns the record if valid, null if not
export function validateApiKey(key: string): ApiKey | null {
  const record = db.prepare(`
    SELECT * FROM api_keys
    WHERE key = ? AND is_active = 1
  `).get(key) as ApiKey | undefined

  if (!record) return null

  // increment request count on every valid use
  db.prepare('UPDATE api_keys SET requests = requests + 1 WHERE key = ?')
    .run(key)

  return record
}

// revoke a key — soft delete, keeps the record for history
export function revokeApiKey(id: string): boolean {
  const result = db.prepare(`
    UPDATE api_keys SET is_active = 0 WHERE id = ?
  `).run(id)

  return result.changes > 0  // true if a row was actually updated
}

// list all keys — useful for admin dashboard later
export function listApiKeys(): ApiKey[] {
  return db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC')
           .all() as ApiKey[]
}