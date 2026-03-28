import { randomUUID } from 'crypto'
import { db }         from '../db/database'

export interface LogEntry {
  apiKeyId:   string | null
  query:      string
  keysFound:  number
  latencyMs:  number
  status:     number
  error?:     string
  cacheHit?:  boolean
  resultKeys?: string  // comma-separated attribute names e.g. "color,brand,price_max"
}

export function logRequest(entry: LogEntry): void {
  try {
    db.prepare(`
      INSERT INTO request_logs
        (id, api_key_id, query, keys_found, latency_ms, status, error, cache_hit, result_keys)
      VALUES
        (@id, @apiKeyId, @query, @keysFound, @latencyMs, @status, @error, @cacheHit, @resultKeys)
    `).run({
      id:         randomUUID(),
      apiKeyId:   entry.apiKeyId   ?? null,
      query:      entry.query,
      keysFound:  entry.keysFound,
      latencyMs:  entry.latencyMs,
      status:     entry.status,
      error:      entry.error      ?? null,
      cacheHit:   entry.cacheHit   ? 1 : 0,
      resultKeys: entry.resultKeys ?? null,
    })
  } catch (err) {
    console.error('Failed to write log:', err)
  }
}