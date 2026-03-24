import express, { Request, Response } from 'express'
import { extractIntent }   from '../core/groqClient'
import { parseResponse }   from '../core/responseParser'
import { requireApiKey }   from '../auth/authMiddleware'
import { createApiKey }    from '../auth/keyGenerator'
import { keysRouter }      from './keysRouter'
import { rateLimiter }     from '../middleware/rateLimiter'
import { sanitizeQuery }   from '../middleware/sanitize'
import { corsMiddleware }  from '../middleware/cors'
import { logRequest }      from '../logger/requestLogger'
import { db }              from '../db/database'

export const app = express()

app.use(corsMiddleware)
app.use(express.json())
app.use(rateLimiter)

function isAdmin(req: Request): boolean {
  return req.headers['x-admin-secret'] === process.env.ADMIN_SECRET
}

// ─── health check ───────────────────────────────────────────────────────────
app.get('/health', (req: Request, res: Response) => {
  let dbStatus = 'connected'
  try { db.prepare('SELECT 1').get() } catch { dbStatus = 'error' }
  res.json({
    status:         'ok',
    database:        dbStatus,
    uptime_seconds:  Math.floor(process.uptime()),
    timestamp:       new Date().toISOString()
  })
})

// ─── public registration ─────────────────────────────────────────────────────
app.post('/register', (req: Request, res: Response) => {
  const { name } = req.body
  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'invalid_input', message: 'name is required' }); return
  }
  if (name.trim().length > 64) {
    res.status(400).json({ error: 'invalid_input', message: 'name must be 64 characters or less' }); return
  }
  try {
    const apiKey = createApiKey(name.trim(), 30)
    const expiry  = apiKey.expires_at ? new Date(apiKey.expires_at) : null
    const now     = new Date()
      const daysLeft = expiry
        ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86400000))
        : null
    res.status(201).json({
      message:    'API key created successfully',
      key:        apiKey.key,
      name:       apiKey.name,
      expires_in:    daysLeft ? daysLeft+' days' : daysLeft,
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ error: 'registration_failed', message: 'failed to create API key' })
  }
})

// ─── GET /key/status ─────────────────────────────────────────────────────────
app.get('/key/status', requireApiKey, (req: Request, res: Response) => {
  // @ts-ignore
  const record = req.apiKey as any

  const now      = new Date()
  const expiry   = record.expires_at ? new Date(record.expires_at) : null
  const daysLeft = expiry
    ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86400000))
    : null

  res.json({
    status:     'active',
    name:       record.name,
    expires_in: daysLeft !== null ? daysLeft + ' days' : null,
    requests:   record.requests
  })
})

// ─── POST /key/refresh ───────────────────────────────────────────────────────
app.post('/key/refresh', requireApiKey, (req: Request, res: Response) => {
  // @ts-ignore
  const record = req.apiKey as any

  const REFRESH_DAYS = 30
  const newExpiry    = new Date()
  newExpiry.setDate(newExpiry.getDate() + REFRESH_DAYS)
  const expires_at   = newExpiry.toISOString().slice(0, 19).replace('T', ' ')

  try {
    db.prepare(`
      UPDATE api_keys SET expires_at = ?, is_active = 1 WHERE id = ?
    `).run(expires_at, record.id)

    res.json({
      message:    'Key expiry refreshed successfully',
      expires_in: REFRESH_DAYS + ' days'
    })
  } catch (error) {
    console.error('Refresh error:', error)
    res.status(500).json({ error: 'refresh_failed', message: 'failed to refresh key expiry' })
  }
})

// ─── GET /logs ────────────────────────────────────────────────────────────────
app.get('/logs', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const limit = Math.min(parseInt(String(req.query.limit || '50')), 200)
  const keyId = req.query.key_id ? String(req.query.key_id) : null

  try {
    const logs = keyId
      ? db.prepare(`
          SELECT id, api_key_id, query, keys_found, latency_ms, status, error, created_at
          FROM request_logs WHERE api_key_id = ? ORDER BY created_at DESC LIMIT ?
        `).all(keyId, limit)
      : db.prepare(`
          SELECT id, api_key_id, query, keys_found, latency_ms, status, error, created_at
          FROM request_logs ORDER BY created_at DESC LIMIT ?
        `).all(limit)

    res.json({ total: logs.length, logs })
  } catch (err) {
    res.status(500).json({ error: 'failed to fetch logs' })
  }
})

// ─── admin key management ─────────────────────────────────────────────────────
app.use('/keys', keysRouter)

// ─── main extract endpoint ────────────────────────────────────────────────────
app.post('/extract', requireApiKey, sanitizeQuery, async (req: Request, res: Response) => {
  const { query } = req.body
  // @ts-ignore
  const apiKeyId  = req.apiKey?.id ?? null
  const startTime = Date.now()

  try {
    const { raw, latencyMs } = await extractIntent(query)
    const result             = parseResponse(raw)
    const keysFound          = Object.keys(result).length

    logRequest({ apiKeyId, query, keysFound, latencyMs, status: 200 })
    res.json({ query, result, keys_found: keysFound, latency_ms: latencyMs })

  } catch (error) {
    const latencyMs = Date.now() - startTime
    logRequest({ apiKeyId, query, keysFound: 0, latencyMs, status: 500, error: String(error) })
    console.error('Extraction error:', error)
    res.status(500).json({ error: 'extraction_failed', result: {} })
  }
})