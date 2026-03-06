import { Request, Response, NextFunction } from 'express'
import { validateApiKey } from './keyGenerator'

export function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // key comes in the Authorization header
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

  // check against database
  const record = validateApiKey(key)

  if (!record) {
    res.status(401).json({
      error:   'unauthorized',
      message: 'invalid or revoked API key'
    })
    return
  }

  // attach key info to request so route handlers can use it
  // @ts-ignore
  req.apiKey = record

  // key is valid — continue to the actual route
  next()
}