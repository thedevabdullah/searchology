import dotenv from 'dotenv'
dotenv.config()

import { app }          from './api/server'
import { initDatabase } from './db/database'

// initialize database before starting server
initDatabase()

const PORT = process.env.PORT ?? 3000

app.listen(PORT, () => {
  console.log(`nl-search-parser running on port ${PORT}`)
})