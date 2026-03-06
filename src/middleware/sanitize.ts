import { Request, Response, NextFunction } from 'express'

const MAX_QUERY_LENGTH = 500

export function sanitizeQuery(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { query } = req.body

  // check existence
  if (!query || typeof query !== 'string') {
    res.status(400).json({
      error:   'invalid_input',
      message: 'query must be a non-empty string'
    })
    return
  }

  // check length
  if (query.length > MAX_QUERY_LENGTH) {
    res.status(400).json({
      error:   'query_too_long',
      message: `query must be ${MAX_QUERY_LENGTH} characters or less`,
      max_length:      MAX_QUERY_LENGTH,
      received_length: query.length
    })
    return
  }

  // strip HTML tags — prevent injection attempts
  const stripped = query.replace(/<[^>]*>/g, '')

  // collapse multiple spaces into one
  const cleaned = stripped.replace(/\s+/g, ' ').trim()

  // check it's not empty after cleaning
  if (cleaned.length === 0) {
    res.status(400).json({
      error:   'invalid_input',
      message: 'query is empty after sanitization'
    })
    return
  }

  // overwrite with clean version
  req.body.query = cleaned

  next()
}