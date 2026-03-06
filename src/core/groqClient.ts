import Groq          from 'groq-sdk'
import { buildSystemPrompt } from './promptBuilder'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

// now returns both the raw response and latency
export async function extractIntent(
  query: string
): Promise<{ raw: string; latencyMs: number }> {

  const start = Date.now()  // start timer

  const response = await groq.chat.completions.create({
    // model:       'llama-3.3-70b-versatile',
    model: 'llama-3.1-8b-instant',
    temperature: 0,
    max_tokens:  200,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user',   content: query               }
    ]
  })

  const latencyMs = Date.now() - start  // calculate duration

  return {
    raw:       response.choices[0]?.message?.content ?? '{}',
    latencyMs
  }
}