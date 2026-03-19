import { Router, Request, Response } from 'express'
import {
  createApiKey,
  revokeApiKey,
  listApiKeys
} from '../auth/keyGenerator'
import { db } from '../db/database'

export const keysRouter = Router()

// simple admin check
function isAdmin(req: Request): boolean {
  const secret = req.headers['x-admin-secret']
  return secret === process.env.ADMIN_SECRET
}

// POST /keys — create a new API key
keysRouter.post('/', (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'forbidden' })
    return
  }

  const { name } = req.body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'name is required' })
    return
  }

  const apiKey = createApiKey(name.trim())

  res.status(201).json({
    message:    'API key created',
    id:         apiKey.id,
    key:        apiKey.key,
    name:       apiKey.name,
    created_at: apiKey.created_at
  })
})

// DELETE /keys/:id — revoke a key
keysRouter.delete('/:id', (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'forbidden' })
    return
  }

  const revoked = revokeApiKey(String(req.params.id))

  if (!revoked) {
    res.status(404).json({ error: 'key not found' })
    return
  }

  res.json({ message: 'key revoked successfully' })
})

// GET /keys — list all keys
keysRouter.get('/', (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'forbidden' })
    return
  }

  const keys = listApiKeys()

  res.json({
    total: keys.length,
    keys:  keys.map(k => ({
      id:         k.id,
      name:       k.name,
      is_active:  k.is_active === 1,
      requests:   k.requests,
      created_at: k.created_at
    }))
  })
})

// GET /logs — recent request logs (admin only)
keysRouter.get('/logs', (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'forbidden' })
    return
  }

  const limit = Math.min(parseInt(String(req.query.limit || '50')), 200)

  try {
    const logs = db.prepare(`
      SELECT
        id,
        api_key_id,
        query,
        keys_found,
        latency_ms,
        status,
        error,
        created_at
      FROM request_logs
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit)

    res.json({
      total: logs.length,
      logs
    })
  } catch (err) {
    res.status(500).json({ error: 'failed to fetch logs' })
  }
})