import express, { Request, Response } from 'express'
import { extractIntent }   from '../core/groqClient'
import { parseResponse }   from '../core/responseParser'
import { requireApiKey }   from '../auth/authMiddleware'
import { keysRouter }      from './keysRouter'
import { rateLimiter }     from '../middleware/rateLimiter'
import { sanitizeQuery }   from '../middleware/sanitize'
import { corsMiddleware }  from '../middleware/cors'
import { logRequest }      from '../logger/requestLogger'
import { db }              from '../db/database'

export const app = express()

// ─── global middleware ───
app.use(corsMiddleware)   // CORS first — handles preflight OPTIONS requests
app.use(express.json())
app.use(rateLimiter)      // rate limit all routes

// ─── health check ───
app.get('/health', (req: Request, res: Response) => {
  // check database is alive
  let dbStatus = 'connected'
  try {
    db.prepare('SELECT 1').get()
  } catch {
    dbStatus = 'error'
  }

  res.json({
    status:          'ok',
    database:        dbStatus,
    uptime_seconds:  Math.floor(process.uptime()),
    timestamp:       new Date().toISOString()
  })
})

// ─── key management ───
app.use('/keys', keysRouter)

// ─── main extract endpoint ───
app.post(
  '/extract',
  requireApiKey,    // 1. check API key
  sanitizeQuery,    // 2. clean and validate input
  async (req: Request, res: Response) => {

    const { query }  = req.body
    // @ts-ignore
    const apiKeyId   = req.apiKey?.id ?? null
    const startTime  = Date.now()

    try {
      const { raw, latencyMs } = await extractIntent(query)
      const result             = parseResponse(raw)
      const keysFound          = Object.keys(result).length

      // log the successful request
      logRequest({
        apiKeyId,
        query,
        keysFound,
        latencyMs,
        status: 200
      })

      res.json({
        query,
        result,
        keys_found:  keysFound,
        latency_ms:  latencyMs   // Feature 5: response time
      })

    } catch (error) {
      const latencyMs = Date.now() - startTime

      // log the failed request
      logRequest({
        apiKeyId,
        query,
        keysFound: 0,
        latencyMs,
        status: 500,
        error:  String(error)
      })

      console.error('Extraction error:', error)

      res.status(500).json({
        error:  'extraction_failed',
        result: {}
      })
    }
  }
)