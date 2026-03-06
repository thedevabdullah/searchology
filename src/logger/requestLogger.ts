import { randomUUID } from 'crypto'
import { db }         from '../db/database'

interface LogEntry {
  apiKeyId:  string | null
  query:     string
  keysFound: number
  latencyMs: number
  status:    number
  error?:    string
}

export function logRequest(entry: LogEntry): void {
  try {
    db.prepare(`
      INSERT INTO request_logs
        (id, api_key_id, query, keys_found, latency_ms, status, error)
      VALUES
        (@id, @apiKeyId, @query, @keysFound, @latencyMs, @status, @error)
    `).run({
      id:        randomUUID(),
      apiKeyId:  entry.apiKeyId  ?? null,
      query:     entry.query,
      keysFound: entry.keysFound,
      latencyMs: entry.latencyMs,
      status:    entry.status,
      error:     entry.error     ?? null
    })
  } catch (err) {
    // logging should never crash your service
    console.error('Failed to write log:', err)
  }
}