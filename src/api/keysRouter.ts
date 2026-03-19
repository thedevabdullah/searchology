import { Router, Request, Response } from 'express'
import { createApiKey, revokeApiKey, listApiKeys } from '../auth/keyGenerator'

export const keysRouter = Router()

function isAdmin(req: Request): boolean {
  return req.headers['x-admin-secret'] === process.env.ADMIN_SECRET
}

// POST /keys — create a new API key
keysRouter.post('/', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const { name } = req.body
  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'name is required' }); return
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
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const revoked = revokeApiKey(String(req.params.id))
  if (!revoked) { res.status(404).json({ error: 'key not found' }); return }
  res.json({ message: 'key revoked successfully' })
})

// GET /keys — list all keys INCLUDING the key value for admin dashboard
keysRouter.get('/', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const keys = listApiKeys()
  res.json({
    total: keys.length,
    keys:  keys.map(k => ({
      id:         k.id,
      key:        k.key,           // ← included for admin dashboard
      name:       k.name,
      is_active:  k.is_active === 1,
      requests:   k.requests,
      created_at: k.created_at
    }))
  })
})