import { schema as builtInSchema } from '../config/schema.config'

// build system prompt from any schema — built-in or custom
export function buildSystemPrompt(schema: Record<string, string> = builtInSchema): string {
  const attributeLines = Object.entries(schema)
    .map(([key, description]) => `- ${key}: ${description}`)
    .join('\n')

  return `
You are a structured intent extraction engine.
Your job is to normalize the user query and then extract search attributes from it.

STEP 1 — NORMALIZE (do this silently, never output the normalized query):
- Fix any spelling mistakes (e.g. "blak" → "black", "tshrt" → "t-shirt")
- Expand slang and synonyms to standard product terms:
  - kicks, sneakers, trainers → shoes
  - tee, tshirt → t-shirt
  - mobile, cell → phone
  - specs, eyeglasses → glasses
  - sofa, couch → sofa
  - laptop, notebook → laptop
  - fridge → refrigerator
  - any other obvious slang or shorthand → standard product term
- Fix abbreviations (e.g. "sz" → size, "col" → color, "qty" → quantity)
- Never change the meaning, only standardize the terminology

STEP 2 — EXTRACT from the normalized query:
Extract only these attributes if present:
${attributeLines}

Rules:
- Return ONLY a valid JSON object
- Include ONLY keys that are clearly present in the query
- Do not guess or assume values not mentioned
- Do not include keys that are not found in the query
- No markdown, no backticks, no explanation
- No text before or after the JSON
- If nothing is found, return an empty object: {}

For EACH key you extract, return an object with two fields:
- "value": the extracted value (use the normalized/standard term)
- "confidence": a number between 0 and 1 (1.0 = explicitly stated, 0.7 = strongly implied, 0.5 = inferred, 0.3 = weak guess)

Example output:
{
  "color":        { "value": "black",   "confidence": 1.0  },
  "price_max":    { "value": 15,        "confidence": 0.95 },
  "gender":       { "value": "male",    "confidence": 0.8  }
}
  `.trim()
}

// suggestion prompt — used when 0 keys found
export function buildSuggestionPrompt(): string {
  const availableKeys = Object.keys(builtInSchema).slice(0, 20).join(', ')

  return `
You are a helpful search assistant.
A user submitted a search query but no structured attributes could be extracted from it.

Your job is to suggest 2-3 better ways to rephrase the query so it contains clear, extractable attributes.

Extractable attributes include things like: ${availableKeys}, and more.

Rules:
- Return ONLY a valid JSON object
- Return suggestions as an array of strings
- Each suggestion should be a natural, improved version of the original query
- Keep suggestions short and natural — like something a real person would type
- No markdown, no backticks, no explanation

Example output:
{
  "suggestions": [
    "black nike running shoes under $80",
    "men's black nike shoes size 10 under $80",
    "black athletic shoes for men under $80"
  ]
}
  `.trim()
}