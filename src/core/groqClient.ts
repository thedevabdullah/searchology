import Groq from 'groq-sdk'
import { buildSystemPrompt, buildSuggestionPrompt, COMPACT_TOKEN_THRESHOLD } from './promptBuilder'
import { getActiveModel } from '../db/database'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── Token budgets ─────────────────────────────────────────────────────────────
// These are the max_tokens values passed to Groq (output tokens only).
// Full mode  : 400 tokens — enough for the largest possible extraction result
// Compact mode: 300 tokens — trimmed; compact extraction output is rarely >200 tokens,
//               and the 100-token saving helps stay within tight per-request limits.
const MAX_TOKENS_FULL    = 400
const MAX_TOKENS_COMPACT = 300

export async function extractIntent(
  query:  string,
  schema?: Record<string, string>
): Promise<{ raw: string; latencyMs: number; compact: boolean }> {

  const { model_id, token_limit } = getActiveModel()

  // Use compact prompt when the model has a known token ceiling at or below threshold
  const compact = token_limit !== null && token_limit <= COMPACT_TOKEN_THRESHOLD

  const start = Date.now()

  const response = await groq.chat.completions.create({
    model:      model_id,
    temperature: 0,
    max_tokens: compact ? MAX_TOKENS_COMPACT : MAX_TOKENS_FULL,
    messages: [
      { role: 'system', content: buildSystemPrompt(schema, compact) },
      { role: 'user',   content: query }
    ]
  })

  return {
    raw:       response.choices[0]?.message?.content ?? '{}',
    latencyMs: Date.now() - start,
    compact
  }
}

export async function getSuggestions(query: string): Promise<string[]> {
  try {
    const { model_id, token_limit } = getActiveModel()
    const compact = token_limit !== null && token_limit <= COMPACT_TOKEN_THRESHOLD

    const response = await groq.chat.completions.create({
      model:      model_id,
      temperature: 0.3,
      max_tokens: compact ? 150 : 200,
      messages: [
        { role: 'system', content: buildSuggestionPrompt() },
        { role: 'user',   content: query }
      ]
    })

    const raw     = response.choices[0]?.message?.content ?? '{}'
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
                       .replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim()
    const parsed  = JSON.parse(cleaned)

    return Array.isArray(parsed.suggestions) ? parsed.suggestions.filter(Boolean) : []
  } catch {
    return []
  }
}