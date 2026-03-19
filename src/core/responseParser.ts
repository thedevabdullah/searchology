import { schema } from '../config/schema.config'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExtractedField {
  value:      unknown
  confidence: number
}

export type ParsedResult = Record<string, ExtractedField>

// ── Layer 2 — clean raw LLM response ──────────────────────────────────────

function cleanResponse(raw: string): string {
  return raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
    .replace(/^[^{[]*/, '')
    .replace(/[^}\]]*$/, '')
    .trim()
}

// ── Layer 3 — safe parse with fallback ────────────────────────────────────

function safeParse(cleaned: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed
  } catch {
    return {}
  }
}

// ── Layer 3 — validate and normalize into confidence format ───────────────

function validateAgainstSchema(parsed: Record<string, unknown>): ParsedResult {
  const validKeys = Object.keys(schema)
  const result: ParsedResult = {}

  for (const key of validKeys) {
    const raw = parsed[key]
    if (raw === undefined || raw === null) continue

    // nested format: { value: x, confidence: 0.9 }
    if (
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      'value' in (raw as object) &&
      'confidence' in (raw as object)
    ) {
      const field = raw as { value: unknown; confidence: unknown }
      if (field.value === null || field.value === undefined) continue

      result[key] = {
        value:      field.value,
        confidence: typeof field.confidence === 'number'
          ? Math.min(1, Math.max(0, field.confidence))
          : 0.5
      }
    } else {
      // LLM returned plain value without confidence — wrap with 0.5
      result[key] = { value: raw, confidence: 0.5 }
    }
  }

  return result
}

// ── Main export ────────────────────────────────────────────────────────────

export function parseResponse(raw: string): ParsedResult {
  const cleaned = cleanResponse(raw)
  const parsed  = safeParse(cleaned)
  return validateAgainstSchema(parsed)
}