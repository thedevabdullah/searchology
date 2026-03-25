import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { db } from '../db/database'

export const modelsRouter = Router()

const DEFAULT_MODEL_ID = 'llama-3.1-8b-instant'

function isAdmin(req: Request): boolean {
  return req.headers['x-admin-secret'] === process.env.ADMIN_SECRET
}

// GET /models — list all models
modelsRouter.get('/', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const models = db.prepare(
    'SELECT * FROM models ORDER BY created_at ASC'
  ).all() as any[]

  res.json({
    total:  models.length,
    models: models.map(m => ({
      id:         m.id,
      name:       m.name,
      model_id:   m.model_id,
      is_active:  m.is_active === 1,
      created_at: m.created_at
    }))
  })
})

// POST /models — add a new model
modelsRouter.post('/', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const { name, model_id } = req.body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'invalid_input', message: 'name is required' }); return
  }
  if (!model_id || typeof model_id !== 'string' || model_id.trim() === '') {
    res.status(400).json({ error: 'invalid_input', message: 'model_id is required' }); return
  }

  // check duplicate
  const existing = db.prepare('SELECT id FROM models WHERE model_id = ?').get(model_id.trim())
  if (existing) {
    res.status(409).json({ error: 'duplicate', message: 'A model with this model_id already exists' }); return
  }

  try {
    const id = randomUUID()
    db.prepare(`
      INSERT INTO models (id, name, model_id, is_active)
      VALUES (?, ?, ?, 0)
    `).run(id, name.trim(), model_id.trim())

    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(id) as any

    res.status(201).json({
      message:   'Model added successfully',
      id:        model.id,
      name:      model.name,
      model_id:  model.model_id,
      is_active: model.is_active === 1
    })
  } catch (error) {
    res.status(500).json({ error: 'create_failed', message: 'Failed to add model' })
  }
})

// PATCH /models/:id/activate — set model as active
modelsRouter.post('/:id/activate', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const model = db.prepare('SELECT * FROM models WHERE id = ?').get(String(req.params.id)) as any

  if (!model) {
    res.status(404).json({ error: 'not_found', message: 'Model not found' }); return
  }

  try {
    // deactivate all models first
    db.prepare('UPDATE models SET is_active = 0').run()
    // activate the selected one
    db.prepare('UPDATE models SET is_active = 1 WHERE id = ?').run(model.id)

    res.json({
      message:   `Model switched to "${model.name}"`,
      model_id:  model.model_id,
      name:      model.name,
      is_active: true
    })
  } catch (error) {
    res.status(500).json({ error: 'activate_failed', message: 'Failed to activate model' })
  }
})

// DELETE /models/:id — remove a model
modelsRouter.delete('/:id', (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: 'forbidden' }); return }

  const model = db.prepare('SELECT * FROM models WHERE id = ?').get(String(req.params.id)) as any

  if (!model) {
    res.status(404).json({ error: 'not_found', message: 'Model not found' }); return
  }

  // prevent deleting the default model
  if (model.model_id === DEFAULT_MODEL_ID) {
    res.status(400).json({
      error:   'cannot_delete_default',
      message: 'The default model (llama-3.1-8b-instant) cannot be deleted'
    }); return
  }

  // if deleting active model — switch back to default
  if (model.is_active === 1) {
    db.prepare('UPDATE models SET is_active = 0').run()
    db.prepare(`UPDATE models SET is_active = 1 WHERE model_id = ?`).run(DEFAULT_MODEL_ID)
  }

  db.prepare('DELETE FROM models WHERE id = ?').run(model.id)

  res.json({
    message: `Model "${model.name}" removed. Switched back to default if it was active.`
  })
})