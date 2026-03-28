import rateLimit from 'express-rate-limit'
import type { Statement } from 'better-sqlite3'
import { db }    from '../db/database'

const DEFAULT_RPM = 60

// Lazy statement — prepared on first request, after initDatabase() has run.
// Cannot be module-level: db.prepare() compiles SQL immediately and would
// crash with "no such column: rate_limit_rpm" before the migration runs.
let stmtGetLimit: Statement<unknown[]> | null = null

function getStmt(): Statement<unknown[]> {
  if (!stmtGetLimit) {
    stmtGetLimit = db.prepare(
      `SELECT rate_limit_rpm FROM api_keys WHERE key = ? AND is_active = 1 LIMIT 1`
    )
  }
  return stmtGetLimit
}

// Extract Bearer token from Authorization header (or null)
function extractBearer(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const key = authHeader.slice(7).trim()
  return key || null
}

export const rateLimiter = rateLimit({
  windowMs:        60 * 1000,

  // Dynamic max: per-key limit from DB, falls back to DEFAULT_RPM.
  // express-rate-limit v7+ accepts a function for max.
  // SQLite read is ~0.1ms — negligible per-request overhead.
  max: (req) => {
    const key = extractBearer(req.headers['authorization'] as string | undefined)
    if (!key) return DEFAULT_RPM
    try {
      const row = getStmt().get(key) as any
      return typeof row?.rate_limit_rpm === 'number' ? row.rate_limit_rpm : DEFAULT_RPM
    } catch {
      return DEFAULT_RPM
    }
  },

  standardHeaders: true,
  legacyHeaders:   false,

  // Rate-limit by API key so each customer has their own window.
  // Unauthenticated traffic shares a single bucket.
  keyGenerator: (req) => {
    const key = extractBearer(req.headers['authorization'] as string | undefined)
    return key ?? 'unauthenticated'
  },

  handler: (req, res, next, options) => {
    const maxVal = typeof options.max === 'function'
      ? (options.max as Function)(req, res)
      : options.max

    res.status(429).json({
      error:               'too_many_requests',
      message:             `You have exceeded ${maxVal} requests per minute`,
      retry_after_seconds: 60
    })
  }
})