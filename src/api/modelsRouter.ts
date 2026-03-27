import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { db } from '../db/database'

export const modelsRouter = Router()

const DEFAULT_MODEL_ID = 'llama-3.1-8b-instant'

// Known Groq per-request token limits for common models (free tier on_demand).
// Used to pre-fill token_limit when a known model_id is registered without one.
const KNOWN_TOKEN_LIMITS: Record<string, number> = {
  'llama-3.1-8b-instant':     6000,
  'llama-3.3-70b-versatile':  32768,
  'llama-3.1-70b-versatile':  32768,
  'mixtral-8x7b-32768':       32768,
  'gemma2-9b-it':              8192,
  'gemma-7b-it':               8192,
}

function isAdmin(req: Request): boolean {
  return req.headers['x-admin-secret'] === process.env.ADMIN_SECRET
}

// ── GET /models — list all models ─────────────────────────────────────────────
modelsRouter.get('/', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const models = db.prepare(
    'SELECT * FROM models ORDER BY created_at ASC'
  ).all() as any[]

  res.json({
    total:  models.length,
    models: models.map(m => ({
      id:          m.id,
      name:        m.name,
      model_id:    m.model_id,
      is_active:   m.is_active === 1,
      token_limit: m.token_limit ?? null,
      prompt_mode: m.token_limit !== null && m.token_limit <= 8000 ? 'compact' : 'full',
      created_at:  m.created_at
    }))
  })
})

// ── POST /models — add a new model ────────────────────────────────────────────
modelsRouter.post('/', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const { name, model_id, token_limit } = req.body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'invalid_input', message: 'name is required' }); return
  }
  if (!model_id || typeof model_id !== 'string' || model_id.trim() === '') {
    res.status(400).json({ error: 'invalid_input', message: 'model_id is required' }); return
  }

  // Validate token_limit if provided
  if (token_limit !== undefined && token_limit !== null) {
    if (typeof token_limit !== 'number' || token_limit < 1000 || !Number.isInteger(token_limit)) {
      res.status(400).json({
        error:   'invalid_input',
        message: 'token_limit must be a positive integer >= 1000'
      }); return
    }
  }

  // Check for duplicate
  const existing = db.prepare('SELECT id FROM models WHERE model_id = ?').get(model_id.trim())
  if (existing) {
    res.status(409).json({ error: 'duplicate', message: 'A model with this model_id already exists' }); return
  }

  try {
    const id = randomUUID()

    // Resolve token_limit: use provided value, then known defaults, then null
    const resolvedLimit: number | null =
      (typeof token_limit === 'number' && token_limit >= 1000)
        ? token_limit
        : (KNOWN_TOKEN_LIMITS[model_id.trim()] ?? null)

    db.prepare(`
      INSERT INTO models (id, name, model_id, is_active, token_limit)
      VALUES (?, ?, ?, 0, ?)
    `).run(id, name.trim(), model_id.trim(), resolvedLimit)

    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(id) as any

    res.status(201).json({
      message:     'Model added successfully',
      id:          model.id,
      name:        model.name,
      model_id:    model.model_id,
      is_active:   model.is_active === 1,
      token_limit: model.token_limit ?? null,
      prompt_mode: model.token_limit !== null && model.token_limit <= 8000 ? 'compact' : 'full'
    })
  } catch (error) {
    res.status(500).json({ error: 'create_failed', message: 'Failed to add model' })
  }
})

// ── POST /models/:id/activate — set model as active ──────────────────────────
modelsRouter.post('/:id/activate', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const model = db.prepare('SELECT * FROM models WHERE id = ?').get(String(req.params.id)) as any

  if (!model) {
    res.status(404).json({ error: 'not_found', message: 'Model not found' }); return
  }

  try {
    db.prepare('UPDATE models SET is_active = 0').run()
    db.prepare('UPDATE models SET is_active = 1 WHERE id = ?').run(model.id)

    res.json({
      message:     `Model switched to "${model.name}"`,
      model_id:    model.model_id,
      name:        model.name,
      is_active:   true,
      token_limit: model.token_limit ?? null,
      prompt_mode: model.token_limit !== null && model.token_limit <= 8000 ? 'compact' : 'full'
    })
  } catch (error) {
    res.status(500).json({ error: 'activate_failed', message: 'Failed to activate model' })
  }
})

// ── PATCH /models/:id/token-limit — update a model's token limit ──────────────
modelsRouter.patch('/:id/token-limit', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const model = db.prepare('SELECT * FROM models WHERE id = ?').get(String(req.params.id)) as any
  if (!model) {
    res.status(404).json({ error: 'not_found', message: 'Model not found' }); return
  }

  const { token_limit } = req.body

  // Allow null to clear the limit (revert to full prompt)
  if (token_limit !== null) {
    if (typeof token_limit !== 'number' || token_limit < 1000 || !Number.isInteger(token_limit)) {
      res.status(400).json({
        error:   'invalid_input',
        message: 'token_limit must be a positive integer >= 1000, or null to remove the limit'
      }); return
    }
  }

  try {
    db.prepare('UPDATE models SET token_limit = ? WHERE id = ?').run(
      token_limit ?? null,
      model.id
    )

    const newLimit = token_limit ?? null
    res.json({
      message:     `Token limit updated for "${model.name}"`,
      token_limit: newLimit,
      prompt_mode: newLimit !== null && newLimit <= 8000 ? 'compact' : 'full'
    })
  } catch (error) {
    res.status(500).json({ error: 'update_failed', message: 'Failed to update token limit' })
  }
})

// ── DELETE /models/:id — remove a model ───────────────────────────────────────
modelsRouter.delete('/:id', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const model = db.prepare('SELECT * FROM models WHERE id = ?').get(String(req.params.id)) as any
  if (!model) {
    res.status(404).json({ error: 'not_found', message: 'Model not found' }); return
  }

  if (model.model_id === DEFAULT_MODEL_ID) {
    res.status(400).json({
      error:   'cannot_delete_default',
      message: 'The default model (llama-3.1-8b-instant) cannot be deleted'
    }); return
  }

  // If deleting the active model, fall back to the default
  if (model.is_active === 1) {
    db.prepare('UPDATE models SET is_active = 0').run()
    db.prepare('UPDATE models SET is_active = 1 WHERE model_id = ?').run(DEFAULT_MODEL_ID)
  }

  db.prepare('DELETE FROM models WHERE id = ?').run(model.id)

  res.json({
    message: `Model "${model.name}" removed. Switched back to default if it was active.`
  })
})