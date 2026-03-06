import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

export const rateLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => {
    // rate limit by API key if present
    const authHeader = req.headers['authorization']
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1]
    }
    return 'unauthenticated';
  },
  handler: (req, res) => {
    res.status(429).json({
      error:               'too_many_requests',
      message:             'you have exceeded 60 requests per minute',
      retry_after_seconds: 60
    })
  }
})