import express, { Request, Response } from 'express'
import { createHash }              from 'crypto'
import { extractIntent, getSuggestions } from '../core/groqClient'
import { parseResponse }           from '../core/responseParser'
import { requireApiKey }           from '../auth/authMiddleware'
import { createApiKey }            from '../auth/keyGenerator'
import { keysRouter }              from './keysRouter'
import { modelsRouter }            from './modelsRouter'
import { rateLimiter }             from '../middleware/rateLimiter'
import { sanitizeQuery }           from '../middleware/sanitize'
import { corsMiddleware }          from '../middleware/cors'
import { logRequest }              from '../logger/requestLogger'
import { db, getCacheEntry, setCacheEntry, clearAllCache, getCacheStats } from '../db/database'
import { schema as builtInSchema } from '../config/schema.config'

export const app = express()

app.use(corsMiddleware)
app.use(express.json())
app.use(rateLimiter)

function isAdmin(req: Request): boolean {
  return req.headers['x-admin-secret'] === process.env.ADMIN_SECRET
}

// ── Build a stable cache key from query + active schema ──────────────────────
// Including the schema JSON in the hash prevents builtin/custom collisions —
// the same query with different schemas must produce different cache entries.
function buildCacheHash(query: string, schema: Record<string, string>): string {
  const payload = query.trim().toLowerCase() + '\x00' + JSON.stringify(schema)
  return createHash('md5').update(payload).digest('hex')
}

// ─── GET /health ──────────────────────────────────────────────────────────────
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

// ─── GET /schema ──────────────────────────────────────────────────────────────
app.get('/schema', (req: Request, res: Response) => {
  const categories: Record<string, Record<string, string>> = {
    product_identity:     {},
    physical:             {},
    target_person:        {},
    occasion_usage:       {},
    pricing:              {},
    quality:              {},
    delivery:             {},
    electronics_tech:     {},
    style_aesthetics:     {},
    food_health_beauty:   {},
    compatibility_format: {},
    special:              {}
  }

  const categoryMap: Record<string, string> = {
    product_type: 'product_identity', product_name: 'product_identity',
    brand:        'product_identity', model:        'product_identity',
    category:     'product_identity', subcategory:  'product_identity',
    color:       'physical', color_secondary: 'physical', size:       'physical',
    size_type:   'physical', material:        'physical', pattern:    'physical',
    shape:       'physical', weight:          'physical', dimensions: 'physical',
    volume:      'physical', capacity:        'physical',
    gender:       'target_person', age:          'target_person',
    age_group:    'target_person', relationship: 'target_person',
    profession:   'target_person', pet_type:     'target_person',
    occasion: 'occasion_usage', season:   'occasion_usage',
    weather:  'occasion_usage', usage:    'occasion_usage',
    activity: 'occasion_usage',
    price_max:    'pricing', price_min:   'pricing',
    currency:     'pricing', budget_label:'pricing', discount: 'pricing',
    condition:    'quality', quality_tier:  'quality',
    rating_min:   'quality', certification: 'quality',
    delivery_speed: 'delivery', location:    'delivery',
    availability:   'delivery', seller_type: 'delivery',
    storage:          'electronics_tech', ram:              'electronics_tech',
    battery:          'electronics_tech', display_size:     'electronics_tech',
    refresh_rate:     'electronics_tech', camera:           'electronics_tech',
    connectivity:     'electronics_tech', operating_system: 'electronics_tech',
    processor:        'electronics_tech', wattage:          'electronics_tech',
    style:    'style_aesthetics', fit:       'style_aesthetics',
    neckline: 'style_aesthetics', sleeve:    'style_aesthetics',
    length:   'style_aesthetics', aesthetic: 'style_aesthetics',
    dietary: 'food_health_beauty', fragrance: 'food_health_beauty',
    compatibility: 'compatibility_format', format:    'compatibility_format',
    platform:      'compatibility_format', room:      'compatibility_format',
    skin_type:     'compatibility_format',
    eco_friendly: 'special', handmade:     'special',
    customizable: 'special', gift_wrap:    'special',
    quantity:     'special', language:     'special',
  }

  for (const [key, description] of Object.entries(builtInSchema)) {
    const cat = categoryMap[key] ?? 'special'
    categories[cat][key] = description
  }

  const filtered = Object.fromEntries(
    Object.entries(categories).filter(([, keys]) => Object.keys(keys).length > 0)
  )

  res.json({ total_keys: Object.keys(builtInSchema).length, schema: filtered })
})

// ─── POST /register ───────────────────────────────────────────────────────────
app.post('/register', (req: Request, res: Response) => {
  const { name } = req.body
  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'invalid_input', message: 'name is required' }); return
  }
  if (name.trim().length > 64) {
    res.status(400).json({ error: 'invalid_input', message: 'name must be 64 characters or less' }); return
  }
  try {
    const apiKey   = createApiKey(name.trim(), 30)
    const expiry   = apiKey.expires_at ? new Date(apiKey.expires_at) : null
    const daysLeft = expiry ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000)) : null
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

// ─── GET /key/status ──────────────────────────────────────────────────────────
app.get('/key/status', requireApiKey, (req: Request, res: Response) => {
  // @ts-ignore
  const record   = req.apiKey as any
  const expiry   = record.expires_at ? new Date(record.expires_at) : null
  const daysLeft = expiry ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000)) : null
  res.json({
    status:         'active',
    name:           record.name,
    expires_in:     daysLeft !== null ? daysLeft + ' days' : null,
    requests:       record.requests,
    custom_schema:  !!record.custom_schema,
    rate_limit_rpm: record.rate_limit_rpm ?? 60,
  })
})

// ─── POST /key/refresh ────────────────────────────────────────────────────────
app.post('/key/refresh', requireApiKey, (req: Request, res: Response) => {
  // @ts-ignore
  const record     = req.apiKey as any
  const DAYS       = 30
  const expires_at = new Date(Date.now() + DAYS * 86400000)
    .toISOString().slice(0, 19).replace('T', ' ')
  try {
    db.prepare('UPDATE api_keys SET expires_at = ?, is_active = 1 WHERE id = ?')
      .run(expires_at, record.id)
    res.json({ message: 'Key expiry refreshed successfully', expires_in: DAYS + ' days' })
  } catch {
    res.status(500).json({ error: 'refresh_failed', message: 'failed to refresh key expiry' })
  }
})

// ─── POST /key/schema ─────────────────────────────────────────────────────────
app.post('/key/schema', requireApiKey, (req: Request, res: Response) => {
  // @ts-ignore
  const record = req.apiKey as any
  const { schema } = req.body
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    res.status(400).json({ error: 'invalid_schema', message: 'schema must be an object' }); return
  }
  for (const [key, val] of Object.entries(schema)) {
    if (typeof val !== 'string' || val.trim() === '') {
      res.status(400).json({ error: 'invalid_schema', message: `key "${key}" must have a string description` }); return
    }
    if (key.length > 64) {
      res.status(400).json({ error: 'invalid_schema', message: `key "${key}" must be 64 characters or less` }); return
    }
  }
  if (Object.keys(schema).length > 50) {
    res.status(400).json({ error: 'invalid_schema', message: 'custom schema cannot have more than 50 keys' }); return
  }
  try {
    db.prepare('UPDATE api_keys SET custom_schema = ? WHERE id = ?')
      .run(JSON.stringify(schema), record.id)
    res.json({ message: 'Custom schema saved successfully', keys_saved: Object.keys(schema).length, keys: Object.keys(schema) })
  } catch {
    res.status(500).json({ error: 'save_failed', message: 'failed to save custom schema' })
  }
})

// ─── GET /key/schema ──────────────────────────────────────────────────────────
app.get('/key/schema', requireApiKey, (req: Request, res: Response) => {
  // @ts-ignore
  const record = req.apiKey as any
  if (!record.custom_schema) {
    res.json({ custom_schema: null, message: 'No custom schema saved. Using built-in schema.' }); return
  }
  try {
    const schema = JSON.parse(record.custom_schema)
    res.json({ keys_count: Object.keys(schema).length, schema })
  } catch {
    res.status(500).json({ error: 'parse_failed', message: 'failed to read custom schema' })
  }
})

// ─── DELETE /key/schema ───────────────────────────────────────────────────────
app.delete('/key/schema', requireApiKey, (req: Request, res: Response) => {
  // @ts-ignore
  const record = req.apiKey as any
  try {
    db.prepare('UPDATE api_keys SET custom_schema = NULL WHERE id = ?').run(record.id)
    res.json({ message: 'Custom schema removed. Using built-in schema.' })
  } catch {
    res.status(500).json({ error: 'delete_failed', message: 'failed to remove custom schema' })
  }
})

// ─── GET /logs ────────────────────────────────────────────────────────────────
app.get('/logs', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }
  const limit = Math.min(parseInt(String(req.query.limit || '50')), 200)
  const keyId = req.query.key_id ? String(req.query.key_id) : null
  try {
    const logs = keyId
      ? db.prepare(`SELECT id, api_key_id, query, keys_found, latency_ms, status, error, cache_hit, created_at FROM request_logs WHERE api_key_id = ? ORDER BY created_at DESC LIMIT ?`).all(keyId, limit)
      : db.prepare(`SELECT id, api_key_id, query, keys_found, latency_ms, status, error, cache_hit, created_at FROM request_logs ORDER BY created_at DESC LIMIT ?`).all(limit)
    res.json({ total: logs.length, logs })
  } catch {
    res.status(500).json({ error: 'failed to fetch logs' })
  }
})

// ─── DELETE /logs ─────────────────────────────────────────────────────────────
app.delete('/logs', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }
  const keyId = req.query.key_id ? String(req.query.key_id) : null
  try {
    const result = keyId
      ? db.prepare('DELETE FROM request_logs WHERE api_key_id = ?').run(keyId)
      : db.prepare('DELETE FROM request_logs').run()
    res.json({ message: 'logs cleared', deleted: result.changes })
  } catch {
    res.status(500).json({ error: 'failed to clear logs' })
  }
})

// ─── GET /analytics ───────────────────────────────────────────────────────────
// Server-side aggregation — never relies on the frontend downloading raw logs.
// All heavy SQLite queries run in-process and return only the compact summary.
app.get('/analytics', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  try {
    // ── 1. 14-day request timeline ────────────────────────────────────────────
    // SQLite datetime normalization: replace space separator with 'T' so
    // date() function parses SQLite "YYYY-MM-DD HH:MM:SS" strings correctly.
    const timeline = db.prepare(`
      SELECT
        date(replace(created_at, ' ', 'T')) AS day,
        COUNT(*)                             AS total,
        SUM(CASE WHEN status = 200 THEN 1 ELSE 0 END) AS success,
        SUM(cache_hit)                       AS cached,
        ROUND(AVG(latency_ms))               AS avg_latency
      FROM request_logs
      WHERE created_at >= datetime('now', '-14 days')
      GROUP BY day
      ORDER BY day ASC
    `).all()

    // ── 2. Top 10 most common queries (case/whitespace normalised) ─────────────
    const topQueries = db.prepare(`
      SELECT
        lower(trim(query))   AS query,
        COUNT(*)             AS count,
        SUM(cache_hit)       AS cache_hits,
        ROUND(AVG(latency_ms)) AS avg_latency
      FROM request_logs
      WHERE status = 200
      GROUP BY lower(trim(query))
      ORDER BY count DESC
      LIMIT 10
    `).all()

    // ── 3. Usage by API key ───────────────────────────────────────────────────
    const byKey = db.prepare(`
      SELECT
        r.api_key_id,
        k.name,
        COUNT(*)                                          AS total_requests,
        SUM(CASE WHEN r.status = 200 THEN 1 ELSE 0 END)  AS successful,
        SUM(r.cache_hit)                                  AS cache_hits,
        ROUND(AVG(r.latency_ms))                          AS avg_latency
      FROM request_logs r
      LEFT JOIN api_keys k ON k.id = r.api_key_id
      GROUP BY r.api_key_id
      ORDER BY total_requests DESC
    `).all()

    // ── 4. Overall summary ────────────────────────────────────────────────────
    const summary = db.prepare(`
      SELECT
        COUNT(*)                                          AS total_requests,
        SUM(CASE WHEN status = 200 THEN 1 ELSE 0 END)    AS successful,
        SUM(CASE WHEN status != 200 THEN 1 ELSE 0 END)   AS failed,
        SUM(cache_hit)                                    AS total_cache_hits,
        ROUND(AVG(CASE WHEN status = 200 THEN latency_ms END)) AS avg_latency_ms
      FROM request_logs
    `).get() as any

    // ── 5. Cache table stats ──────────────────────────────────────────────────
    const cacheStats = getCacheStats()

    const cacheHitRate = summary?.total_requests > 0
      ? Math.round((summary.total_cache_hits / summary.total_requests) * 100)
      : 0

    res.json({
      summary: {
        total_requests:   summary?.total_requests   ?? 0,
        successful:       summary?.successful       ?? 0,
        failed:           summary?.failed           ?? 0,
        total_cache_hits: summary?.total_cache_hits ?? 0,
        cache_hit_rate:   cacheHitRate,
        avg_latency_ms:   summary?.avg_latency_ms   ?? 0,
      },
      cache: {
        active_entries: cacheStats.active,
        total_hits:     cacheStats.total_hits,
      },
      timeline,
      top_queries: topQueries,
      by_key:      byKey,
    })
  } catch (err) {
    console.error('Analytics error:', err)
    res.status(500).json({ error: 'analytics_failed' })
  }
})

// ─── DELETE /cache — flush the query cache (admin only) ───────────────────────
app.delete('/cache', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }
  try {
    const deleted = clearAllCache()
    res.json({ message: 'Query cache cleared', deleted })
  } catch {
    res.status(500).json({ error: 'failed to clear cache' })
  }
})

// ─── Admin routers ────────────────────────────────────────────────────────────
app.use('/keys',   keysRouter)
app.use('/models', modelsRouter)

// ─── POST /extract — main extraction endpoint ─────────────────────────────────
app.post('/extract', requireApiKey, sanitizeQuery, async (req: Request, res: Response) => {
  const { query }  = req.body
  const useCustom  = req.query.schema === 'true' || req.body.schema === 'true'

  // @ts-ignore
  const record     = req.apiKey as any
  const apiKeyId   = record?.id ?? null
  const startTime  = Date.now()
  const schemaType = useCustom ? 'custom' : 'builtin'

  // ── Resolve active schema ─────────────────────────────────────────────────
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

  // ── Cache lookup ──────────────────────────────────────────────────────────
  const cacheHash   = buildCacheHash(query, activeSchema)
  const cachedJson  = getCacheEntry(cacheHash)

  if (cachedJson) {
    // Cache HIT — return immediately, no Groq call needed
    try {
      const result    = JSON.parse(cachedJson)
      const keysFound = Object.keys(result).length
      const latencyMs = Date.now() - startTime

      logRequest({
        apiKeyId,
        query,
        keysFound,
        latencyMs,
        status:     200,
        cacheHit:   true,
        resultKeys: Object.keys(result).join(',') || undefined,
      })

      res.json({
        query,
        result,
        keys_found:  keysFound,
        latency_ms:  latencyMs,
        schema_used: schemaType,
        cached:      true,
      })
      return
    } catch {
      // Corrupt cache entry — fall through to live extraction
    }
  }

  // ── Live extraction ───────────────────────────────────────────────────────
  try {
    const { raw, latencyMs } = await extractIntent(query, activeSchema)
    const result             = parseResponse(raw, activeSchema)
    const keysFound          = Object.keys(result).length

    // Only cache successful extractions with at least one attribute found.
    // Never cache keys_found=0 — those queries need fresh suggestions each time.
    if (keysFound > 0) {
      setCacheEntry(cacheHash, JSON.stringify(result), schemaType)
    }

    // Suggestions when nothing was extracted
    let suggestions: string[] | undefined
    if (keysFound === 0) {
      suggestions = await getSuggestions(query)
    }

    logRequest({
      apiKeyId,
      query,
      keysFound,
      latencyMs,
      status:     200,
      cacheHit:   false,
      resultKeys: keysFound > 0 ? Object.keys(result).join(',') : undefined,
    })

    res.json({
      query,
      result,
      keys_found:  keysFound,
      latency_ms:  latencyMs,
      schema_used: schemaType,
      cached:      false,
      ...(suggestions && suggestions.length > 0 && {
        suggestions,
        hint: 'No attributes found. Try one of the suggested queries above.'
      })
    })

  } catch (error: any) {
    const latencyMs = Date.now() - startTime

    if (error?.status === 413 || error?.error?.error?.code === 'rate_limit_exceeded') {
      const retryAfter = error?.headers?.['retry-after']
        ? parseInt(error.headers['retry-after'], 10)
        : null
      logRequest({ apiKeyId, query, keysFound: 0, latencyMs, status: 413, error: 'prompt_too_large' })
      res.status(413).json({
        error:   'prompt_too_large',
        message: 'The active model\'s token limit is too small for the current schema. ' +
                 'Switch to a model with a higher token limit (e.g. llama-3.3-70b-versatile), ' +
                 'or set a token_limit on the active model via PATCH /models/:id/token-limit ' +
                 'so the system can automatically use the compact prompt.',
        ...(retryAfter && { retry_after_seconds: retryAfter }),
        result: {}
      })
      return
    }

    logRequest({ apiKeyId, query, keysFound: 0, latencyMs, status: 500, error: String(error) })
    console.error('Extraction error:', error)
    res.status(500).json({ error: 'extraction_failed', result: {} })
  }
})