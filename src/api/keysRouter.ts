import { Router, Request, Response } from 'express'
import { createApiKey, revokeApiKey, listApiKeys, updateKeyExpiry } from '../auth/keyGenerator'

export const keysRouter = Router()

function isAdmin(req: Request): boolean {
  return req.headers['x-admin-secret'] === process.env.ADMIN_SECRET
}

// POST /keys — create a new API key (admin sets expiry, defaults to 30 days)
keysRouter.post('/', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const { name, expires_in_days } = req.body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'name is required' }); return
  }

  const days = typeof expires_in_days === 'number' && expires_in_days > 0
    ? expires_in_days
    : 30   // default 30 days

  const apiKey = createApiKey(name.trim(), days)
  const expiry  = apiKey.expires_at ? new Date(apiKey.expires_at) : null
  const now     = new Date()
    const daysLeft = expiry
      ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86400000))
      : null
  res.status(201).json({
    message:    'API key created',
    key:        apiKey.key,
    name:       apiKey.name,
    expires_in:    daysLeft ? daysLeft+' days' : daysLeft,
  })
})

// PATCH /keys/:id/expiry — update expiry on an existing key
keysRouter.patch('/:id/expiry', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const { expires_in_days } = req.body

  if (typeof expires_in_days !== 'number' || expires_in_days <= 0) {
    res.status(400).json({ error: 'expires_in_days must be a positive number' }); return
  }

  const updated = updateKeyExpiry(String(req.params.id), expires_in_days)

  if (!updated) { res.status(404).json({ error: 'key not found' }); return }

  res.json({
    message:         'expiry updated successfully',
    expires_in_days: expires_in_days
  })
})

// DELETE /keys/:id — revoke a key
keysRouter.delete('/:id', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const revoked = revokeApiKey(String(req.params.id))
  if (!revoked) { res.status(404).json({ error: 'key not found' }); return }
  res.json({ message: 'key revoked successfully' })
})

// GET /keys — list all keys with expiry info
keysRouter.get('/', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const keys = listApiKeys()

  res.json({
    total: keys.length,
    keys:  keys.map(k => {
      const now     = new Date()
      const expiry  = k.expires_at ? new Date(k.expires_at) : null
      const expired = expiry ? expiry < now : false
      const daysLeft = expiry
        ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86400000))
        : null

      return {
        id:         k.id,
        key:        k.key,
        name:       k.name,
        is_active:  k.is_active === 1 && !expired,
        requests:   k.requests,
        expires_at: k.expires_at,
        days_left:  daysLeft,
        expired,
        created_at: k.created_at
      }
    })
  })
})