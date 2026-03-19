import { Request, Response, NextFunction } from 'express'
import { validateApiKey } from './keyGenerator'

export function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization']

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error:   'unauthorized',
      message: 'provide your API key in the Authorization header as: Bearer YOUR_KEY'
    })
    return
  }

  const key = authHeader.split(' ')[1]

  if (!key) {
    res.status(401).json({
      error:   'unauthorized',
      message: 'API key is missing'
    })
    return
  }

  const record = validateApiKey(key)

  if (!record) {
    // could be invalid, revoked, or expired — validateApiKey handles all three
    res.status(401).json({
      error:   'unauthorized',
      message: 'invalid, revoked, or expired API key'
    })
    return
  }

  // @ts-ignore
  req.apiKey = record
  next()
}