import Groq from 'groq-sdk'
import { buildSystemPrompt, buildSuggestionPrompt } from './promptBuilder'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// extract intent with optional custom schema
export async function extractIntent(
  query: string,
  schema?: Record<string, string>
): Promise<{ raw: string; latencyMs: number }> {

  const start = Date.now()

  const response = await groq.chat.completions.create({
    model:       'llama-3.1-8b-instant',
    temperature: 0,
    max_tokens:  400,
    messages: [
      { role: 'system', content: buildSystemPrompt(schema) },
      { role: 'user',   content: query }
    ]
  })

  return {
    raw:       response.choices[0]?.message?.content ?? '{}',
    latencyMs: Date.now() - start
  }
}

// get query suggestions when extraction returns 0 keys
export async function getSuggestions(query: string): Promise<string[]> {
  try {
    const response = await groq.chat.completions.create({
      model:       'llama-3.1-8b-instant',
      temperature: 0.3,  // slight creativity for varied suggestions
      max_tokens:  200,
      messages: [
        { role: 'system', content: buildSuggestionPrompt() },
        { role: 'user',   content: query }
      ]
    })

    const raw     = response.choices[0]?.message?.content ?? '{}'
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
    const parsed  = JSON.parse(cleaned)

    return Array.isArray(parsed.suggestions) ? parsed.suggestions : []
  } catch {
    // suggestions failing should never break extraction
    return []
  }
}