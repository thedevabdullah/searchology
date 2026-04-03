import Groq from 'groq-sdk'
import { buildSystemPrompt, buildSuggestionPrompt, COMPACT_TOKEN_THRESHOLD } from './promptBuilder'
import { getActiveModel } from '../db/database'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── Token budgets ─────────────────────────────────────────────────────────────
const MAX_TOKENS_FULL    = 400
const MAX_TOKENS_COMPACT = 300

// ── Retry configuration ───────────────────────────────────────────────────────
// Retries on transient network failures and Groq 429 / 5xx responses.
// Non-retryable errors (400 Bad Request, 401 Unauthorized, 413 Too Large) are
// thrown immediately — retrying them would not help and wastes time.
const RETRY_DELAYS_MS = [100, 300] // delays before attempt 2 and 3

function isRetryable(err: any): boolean {
  if (!err?.status) return true          // network-level error (no HTTP status)
  if (err.status === 429) return true    // rate limited — back off and retry
  if (err.status >= 500) return true     // Groq server error — transient
  return false                           // 4xx client errors — do not retry
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetryable(err)) throw err   // bail immediately on non-retryable
      const isLast = attempt === maxAttempts - 1
      if (isLast) break
      const delay = RETRY_DELAYS_MS[attempt] ?? 300
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

// ── extractIntent ─────────────────────────────────────────────────────────────
export async function extractIntent(
  query:  string,
  schema?: Record<string, string>
): Promise<{ raw: string; latencyMs: number; compact: boolean }> {

  const { model_id, token_limit } = getActiveModel()
  const compact = token_limit !== null && token_limit <= COMPACT_TOKEN_THRESHOLD

  const start = Date.now()

  const response = await withRetry(() =>
    groq.chat.completions.create({
      model:       model_id,
      temperature: 0,
      max_tokens:  compact ? MAX_TOKENS_COMPACT : MAX_TOKENS_FULL,
      messages: [
        { role: 'system', content: buildSystemPrompt(schema, compact) },
        { role: 'user',   content: query }
      ]
    })
  )

  return {
    raw:       response.choices[0]?.message?.content ?? '{}',
    latencyMs: Date.now() - start,
    compact
  }
}

// ── getSuggestions ────────────────────────────────────────────────────────────
export async function getSuggestions(query: string): Promise<string[]> {
  try {
    const { model_id, token_limit } = getActiveModel()
    const compact = token_limit !== null && token_limit <= COMPACT_TOKEN_THRESHOLD

    const response = await withRetry(() =>
      groq.chat.completions.create({
        model:       model_id,
        temperature: 0.3,
        max_tokens:  compact ? 150 : 200,
        messages: [
          { role: 'system', content: buildSuggestionPrompt() },
          { role: 'user',   content: query }
        ]
      })
    )

    const raw     = response.choices[0]?.message?.content ?? '{}'
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
                       .replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim()
    const parsed  = JSON.parse(cleaned)

    return Array.isArray(parsed.suggestions) ? parsed.suggestions.filter(Boolean) : []
  } catch {
    return []
  }
}