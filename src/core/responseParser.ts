import { schema } from '../config/schema.config'

// Layer 2 — clean raw LLM response
function cleanResponse(raw: string): string {
  return raw
    .replace(/```json/gi, '')  // remove ```json
    .replace(/```/g, '')       // remove remaining backticks
    .trim()                    // remove whitespace
    .replace(/^[^{[]*/, '')    // remove anything before first { or [
    .replace(/[^}\]]*$/, '')   // remove anything after last } or ]
    .trim()
}

// Layer 3 — safe parse with fallback
function safeParse(cleaned: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(cleaned)

    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return parsed
  } catch {
    return {}
  }
}

// Layer 3 — strip keys not in your schema
function validateAgainstSchema(
  parsed: Record<string, unknown>
): Record<string, unknown> {
  const validKeys = Object.keys(schema)
  const result: Record<string, unknown> = {}

  for (const key of validKeys) {
    if (parsed[key] !== undefined && parsed[key] !== null) {
      result[key] = parsed[key]
    }
  }

  return result
}

// main export — runs all three layers
export function parseResponse(raw: string): Record<string, unknown> {
  const cleaned = cleanResponse(raw)
  const parsed = safeParse(cleaned)
  return validateAgainstSchema(parsed)
}