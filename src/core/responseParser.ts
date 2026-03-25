import { schema } from '../config/schema.config'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExtractedField {
  value:      unknown
  confidence: number
}

export type ParsedResult = Record<string, ExtractedField>

// fixed threshold — anything below 0.3 is pure hallucination, always dropped
const MIN_CONFIDENCE = 0.3

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

// ── Layer 3 — safe parse ───────────────────────────────────────────────────

function safeParse(cleaned: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed
  } catch {
    return {}
  }
}

// ── Layer 3 — validate and apply fixed threshold ───────────────────────────

function validateAgainstSchema(
  parsed:       Record<string, unknown>,
  activeSchema: Record<string, string> = schema
): ParsedResult {
  const validKeys = Object.keys(activeSchema)
  const result: ParsedResult = {}

  for (const key of validKeys) {
    const raw = parsed[key]
    if (raw === undefined || raw === null) continue

    let value:      unknown
    let confidence: number

    if (
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      'value'      in (raw as object) &&
      'confidence' in (raw as object)
    ) {
      const field = raw as { value: unknown; confidence: unknown }
      if (field.value === null || field.value === undefined) continue

      value      = field.value
      confidence = typeof field.confidence === 'number'
        ? Math.min(1, Math.max(0, field.confidence))
        : 0
    } else {
      // plain value without confidence — treat as minimum
      value      = raw
      confidence = MIN_CONFIDENCE
    }

    // drop anything below 0.3
    if (confidence < MIN_CONFIDENCE) continue

    result[key] = { value, confidence }
  }

  return result
}

// ── Main export ────────────────────────────────────────────────────────────

export function parseResponse(
  raw:          string,
  activeSchema: Record<string, string> = schema
): ParsedResult {
  const cleaned = cleanResponse(raw)
  const parsed  = safeParse(cleaned)
  return validateAgainstSchema(parsed, activeSchema)
}