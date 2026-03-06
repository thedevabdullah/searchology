import cors from 'cors'

// origins allowed to call your API from a browser
// * means anyone — fine for a public API
// for private API replace with specific domains:
// ['https://yourstore.com', 'https://app.yourstore.com']
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?? '*'

export const corsMiddleware = cors({
  origin:  ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-admin-secret'
  ]
})
// Also add to `.env`:
// ```
// ALLOWED_ORIGINS=*
// ```

// For production you can change `*` to specific domains:
// ```
// ALLOWED_ORIGINS=https://yourstore.com,https://dashboard.yourstore.com