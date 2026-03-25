import express, { Request, Response } from 'express'
import { extractIntent, getSuggestions } from '../core/groqClient'
import { parseResponse }   from '../core/responseParser'
import { requireApiKey }   from '../auth/authMiddleware'
import { createApiKey }    from '../auth/keyGenerator'
import { keysRouter }      from './keysRouter'
import { modelsRouter }    from './modelsRouter'
import { rateLimiter }     from '../middleware/rateLimiter'
import { sanitizeQuery }   from '../middleware/sanitize'
import { corsMiddleware }  from '../middleware/cors'
import { logRequest }      from '../logger/requestLogger'
import { db }              from '../db/database'
import { schema as builtInSchema } from '../config/schema.config'

export const app = express()

app.use(corsMiddleware)
app.use(express.json())
app.use(rateLimiter)

function isAdmin(req: Request): boolean {
  return req.headers['x-admin-secret'] === process.env.ADMIN_SECRET
}

// ─── health check ─────────────────────────────────────────────────────────────
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

// ─── GET /schema — returns full built-in schema ────────────────────────────────
app.get('/schema', (req: Request, res: Response) => {
  const categories: Record<string, Record<string, string>> = {
    product_identity: {},
    physical:         {},
    target_person:    {},
    occasion_usage:   {},
    pricing:          {},
    quality:          {},
    delivery:         {},
    electronics:      {},
    style:            {},
    special:          {}
  }

  // map each key to its category
  const categoryMap: Record<string, string> = {
    product_type: 'product_identity', product_name: 'product_identity',
    brand: 'product_identity', model: 'product_identity',
    category: 'product_identity', subcategory: 'product_identity',
    color: 'physical', color_secondary: 'physical', size: 'physical',
    size_type: 'physical', material: 'physical', pattern: 'physical',
    shape: 'physical', weight: 'physical', dimensions: 'physical',
    gender: 'target_person', age: 'target_person', age_group: 'target_person',
    relationship: 'target_person', profession: 'target_person',
    occasion: 'occasion_usage', season: 'occasion_usage', weather: 'occasion_usage',
    usage: 'occasion_usage', activity: 'occasion_usage',
    price_max: 'pricing', price_min: 'pricing', currency: 'pricing',
    budget_label: 'pricing', discount: 'pricing',
    condition: 'quality', quality_tier: 'quality', rating_min: 'quality',
    certification: 'quality',
    delivery_speed: 'delivery', location: 'delivery', availability: 'delivery',
    seller_type: 'delivery',
    storage: 'electronics', ram: 'electronics', battery: 'electronics',
    display_size: 'electronics', connectivity: 'electronics',
    operating_system: 'electronics', processor: 'electronics',
    style: 'style', fit: 'style', neckline: 'style', sleeve: 'style',
    aesthetic: 'style',
    eco_friendly: 'special', handmade: 'special', customizable: 'special',
    gift_wrap: 'special', quantity: 'special', language: 'special'
  }

  for (const [key, description] of Object.entries(builtInSchema)) {
    const cat = categoryMap[key] ?? 'special'
    categories[cat][key] = description
  }

  // remove empty categories
  const filtered = Object.fromEntries(
    Object.entries(categories).filter(([, keys]) => Object.keys(keys).length > 0)
  )

  res.json({
    total_keys: Object.keys(builtInSchema).length,
    schema:     filtered
  })
})

// ─── public registration ───────────────────────────────────────────────────────
app.post('/register', (req: Request, res: Response) => {
  const { name } = req.body
  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'invalid_input', message: 'name is required' }); return
  }
  if (name.trim().length > 64) {
    res.status(400).json({ error: 'invalid_input', message: 'name must be 64 characters or less' }); return
  }
  try {
    const apiKey  = createApiKey(name.trim(), 30)
    const expiry  = apiKey.expires_at ? new Date(apiKey.expires_at) : null
    const now     = new Date()
    const daysLeft = expiry
      ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86400000))
      : null

    res.status(201).json({
      message:    'API key created successfully',
      key:        apiKey.key,
      name:       apiKey.name,
      expires_in: daysLeft ? daysLeft + ' days' : null
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ error: 'registration_failed', message: 'failed to create API key' })
  }
})

// ─── GET /key/status ───────────────────────────────────────────────────────────
app.get('/key/status', requireApiKey, (req: Request, res: Response) => {
  // @ts-ignore
  const record   = req.apiKey as any
  const now      = new Date()
  const expiry   = record.expires_at ? new Date(record.expires_at) : null
  const daysLeft = expiry
    ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86400000))
    : null

  const hasCustomSchema = !!record.custom_schema

  res.json({
    status:            'active',
    name:              record.name,
    expires_in:        daysLeft !== null ? daysLeft + ' days' : null,
    requests:          record.requests,
    custom_schema:     hasCustomSchema
  })
})

// ─── POST /key/refresh ─────────────────────────────────────────────────────────
app.post('/key/refresh', requireApiKey, (req: Request, res: Response) => {
  // @ts-ignore
  const record      = req.apiKey as any
  const REFRESH_DAYS = 30
  const newExpiry   = new Date()
  newExpiry.setDate(newExpiry.getDate() + REFRESH_DAYS)
  const expires_at  = newExpiry.toISOString().slice(0, 19).replace('T', ' ')

  try {
    db.prepare('UPDATE api_keys SET expires_at = ?, is_active = 1 WHERE id = ?')
      .run(expires_at, record.id)

    res.json({
      message:    'Key expiry refreshed successfully',
      expires_in: REFRESH_DAYS + ' days'
    })
  } catch (error) {
    res.status(500).json({ error: 'refresh_failed', message: 'failed to refresh key expiry' })
  }
})

// ─── POST /key/schema — save custom schema against key ────────────────────────
app.post('/key/schema', requireApiKey, (req: Request, res: Response) => {
  // @ts-ignore
  const record = req.apiKey as any
  const { schema } = req.body

  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    res.status(400).json({
      error:   'invalid_schema',
      message: 'schema must be an object with key-description pairs'
    }); return
  }

  // validate — each value must be a string description
  for (const [key, val] of Object.entries(schema)) {
    if (typeof val !== 'string' || val.trim() === '') {
      res.status(400).json({
        error:   'invalid_schema',
        message: `key "${key}" must have a string description`
      }); return
    }
    if (key.length > 64) {
      res.status(400).json({
        error:   'invalid_schema',
        message: `key "${key}" must be 64 characters or less`
      }); return
    }
  }

  // limit schema size
  if (Object.keys(schema).length > 50) {
    res.status(400).json({
      error:   'invalid_schema',
      message: 'custom schema cannot have more than 50 keys'
    }); return
  }

  try {
    db.prepare('UPDATE api_keys SET custom_schema = ? WHERE id = ?')
      .run(JSON.stringify(schema), record.id)

    res.json({
      message:    'Custom schema saved successfully',
      keys_saved: Object.keys(schema).length,
      keys:       Object.keys(schema)
    })
  } catch (error) {
    res.status(500).json({ error: 'save_failed', message: 'failed to save custom schema' })
  }
})

// ─── GET /key/schema — retrieve saved custom schema ───────────────────────────
app.get('/key/schema', requireApiKey, (req: Request, res: Response) => {
  // @ts-ignore
  const record = req.apiKey as any

  if (!record.custom_schema) {
    res.json({
      custom_schema: null,
      message:       'No custom schema saved. Using built-in schema.'
    }); return
  }

  try {
    const schema = JSON.parse(record.custom_schema)
    res.json({
      keys_count: Object.keys(schema).length,
      schema
    })
  } catch {
    res.status(500).json({ error: 'parse_failed', message: 'failed to read custom schema' })
  }
})

// ─── DELETE /key/schema — remove custom schema, fall back to built-in ─────────
app.delete('/key/schema', requireApiKey, (req: Request, res: Response) => {
  // @ts-ignore
  const record = req.apiKey as any

  try {
    db.prepare('UPDATE api_keys SET custom_schema = NULL WHERE id = ?').run(record.id)
    res.json({
      message: 'Custom schema removed. Using built-in schema.'
    })
  } catch (error) {
    res.status(500).json({ error: 'delete_failed', message: 'failed to remove custom schema' })
  }
})

// ─── GET /logs ─────────────────────────────────────────────────────────────────
app.get('/logs', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const limit = Math.min(parseInt(String(req.query.limit || '50')), 200)
  const keyId = req.query.key_id ? String(req.query.key_id) : null

  try {
    const logs = keyId
      ? db.prepare(`SELECT id, api_key_id, query, keys_found, latency_ms, status, error, created_at FROM request_logs WHERE api_key_id = ? ORDER BY created_at DESC LIMIT ?`).all(keyId, limit)
      : db.prepare(`SELECT id, api_key_id, query, keys_found, latency_ms, status, error, created_at FROM request_logs ORDER BY created_at DESC LIMIT ?`).all(limit)

    res.json({ total: logs.length, logs })
  } catch (err) {
    res.status(500).json({ error: 'failed to fetch logs' })
  }
})

// ─── admin key management ──────────────────────────────────────────────────────
app.use('/keys',   keysRouter)
app.use('/models', modelsRouter)

// ─── main extract endpoint ─────────────────────────────────────────────────────
app.post('/extract', requireApiKey, sanitizeQuery, async (req: Request, res: Response) => {
  const { query }     = req.body
  const useCustom     = req.query.schema === 'true' || req.body.schema === 'true'

  // @ts-ignore
  const record        = req.apiKey as any
  const apiKeyId      = record?.id ?? null
  const startTime     = Date.now()

  // determine which schema to use
  let activeSchema: Record<string, string> = builtInSchema

  if (useCustom) {
    if (!record.custom_schema) {
      res.status(400).json({
        error:   'no_custom_schema',
        message: 'No custom schema saved. Save one via POST /key/schema or remove ?schema=true to use built-in schema.'
      }); return
    }
    try {
      activeSchema = JSON.parse(record.custom_schema)
    } catch {
      res.status(400).json({ error: 'invalid_schema', message: 'Custom schema is malformed' }); return
    }
  }

  try {
    const { raw, latencyMs } = await extractIntent(query, activeSchema)
    const result                    = parseResponse(raw)
    const keysFound                 = Object.keys(result).length

    // query suggestions when nothing extracted
    let suggestions: string[] | undefined
    if (keysFound === 0) {
      suggestions = await getSuggestions(query)
    }

    logRequest({ apiKeyId, query, keysFound, latencyMs, status: 200 })

    res.json({
      query,
      result,
      keys_found:  keysFound,
      latency_ms:  latencyMs,
      schema_used: useCustom ? 'custom' : 'builtin',
      ...(suggestions && suggestions.length > 0 && {
        suggestions,
        hint: 'No attributes found. Try one of the suggested queries above.'
      })
    })

  } catch (error) {
    const latencyMs = Date.now() - startTime
    logRequest({ apiKeyId, query, keysFound: 0, latencyMs, status: 500, error: String(error) })
    console.error('Extraction error:', error)
    res.status(500).json({ error: 'extraction_failed', result: {} })
  }
})