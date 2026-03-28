import { Router, Request, Response }                                                         from 'express'
import { createApiKey, revokeApiKey, deleteApiKey, deleteCustomSchema,
         listApiKeys, updateKeyExpiry, updateRateLimit }                                      from '../auth/keyGenerator'

export const keysRouter = Router()

function isAdmin(req: Request): boolean {
  return req.headers['x-admin-secret'] === process.env.ADMIN_SECRET
}

function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
}

// ── POST /keys — create a new key ─────────────────────────────────────────────
keysRouter.post('/', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const { name, expires_in_days, rate_limit_rpm } = req.body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'name is required' }); return
  }

  const days = typeof expires_in_days === 'number' && expires_in_days > 0 ? expires_in_days : 30
  const rpm  = typeof rate_limit_rpm  === 'number' && rate_limit_rpm  > 0 ? rate_limit_rpm  : 60

  const apiKey = createApiKey(name.trim(), days, rpm)
  const left   = daysLeft(apiKey.expires_at)

  res.status(201).json({
    message:        'API key created',
    key:            apiKey.key,
    name:           apiKey.name,
    expires_in:     left !== null ? left + ' days' : null,
    rate_limit_rpm: apiKey.rate_limit_rpm,
  })
})

// ── PATCH /keys/:id/expiry — update expiry ────────────────────────────────────
keysRouter.patch('/:id/expiry', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const { expires_in_days } = req.body
  if (typeof expires_in_days !== 'number' || expires_in_days <= 0) {
    res.status(400).json({ error: 'expires_in_days must be a positive number' }); return
  }

  if (!updateKeyExpiry(String(req.params.id), expires_in_days)) {
    res.status(404).json({ error: 'key not found' }); return
  }

  res.json({ message: 'expiry updated successfully', expires_in_days })
})

// ── PATCH /keys/:id/rate-limit — update rate limit ────────────────────────────
keysRouter.patch('/:id/rate-limit', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const { rate_limit_rpm } = req.body
  if (typeof rate_limit_rpm !== 'number' || rate_limit_rpm < 1 || !Number.isInteger(rate_limit_rpm)) {
    res.status(400).json({ error: 'rate_limit_rpm must be a positive integer' }); return
  }
  if (rate_limit_rpm > 10000) {
    res.status(400).json({ error: 'rate_limit_rpm cannot exceed 10000' }); return
  }

  if (!updateRateLimit(String(req.params.id), rate_limit_rpm)) {
    res.status(404).json({ error: 'key not found' }); return
  }

  res.json({ message: 'rate limit updated successfully', rate_limit_rpm })
})

// ── DELETE /keys/:id — revoke or permanently delete ───────────────────────────
keysRouter.delete('/:id', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const id        = String(req.params.id)
  const permanent = req.query.permanent === 'true'

  if (permanent) {
    if (!deleteApiKey(id)) { res.status(404).json({ error: 'key not found' }); return }
    res.json({ message: 'key permanently deleted' })
  } else {
    if (!revokeApiKey(id)) { res.status(404).json({ error: 'key not found' }); return }
    res.json({ message: 'key revoked successfully' })
  }
})

// ── DELETE /keys/:id/schema — remove custom schema ───────────────────────────
keysRouter.delete('/:id/schema', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  if (!deleteCustomSchema(String(req.params.id))) {
    res.status(404).json({ error: 'key not found' }); return
  }
  res.json({ message: 'custom schema removed' })
})

// ── GET /keys — list all keys ─────────────────────────────────────────────────
keysRouter.get('/', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const keys = listApiKeys()

  res.json({
    total: keys.length,
    keys:  keys.map(k => {
      const expiry  = k.expires_at ? new Date(k.expires_at) : null
      const expired = expiry ? expiry < new Date() : false
      const left    = daysLeft(k.expires_at)

      return {
        id:             k.id,
        key:            k.key,
        name:           k.name,
        is_active:      k.is_active === 1 && !expired,
        requests:       k.requests,
        expires_at:     k.expires_at,
        days_left:      left,
        expired,
        custom_schema:  k.custom_schema || null,
        rate_limit_rpm: k.rate_limit_rpm ?? 60,
        created_at:     k.created_at,
      }
    })
  })
})