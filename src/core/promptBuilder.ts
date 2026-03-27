import { schema as builtInSchema } from '../config/schema.config'

// ── Token threshold ───────────────────────────────────────────────────────────
// Models whose token_limit is at or below this value get the compact prompt.
// Compact prompt ≈ 4800 tokens + 300 max_tokens output = ~5100, safely under 6000.
export const COMPACT_TOKEN_THRESHOLD = 8000

// ── compactify ────────────────────────────────────────────────────────────────
// Strips verbose categorised examples from a field description, keeping only
// the core constraint. Designed for the multi-line schema in schema.config.ts.
//
// Rules by description shape:
//   "Output exactly one: A | B | C. → examples..."  → keep up to first '. '
//   "Output true ONLY when ..."                     → keep up to first '. '
//   "Core meaning — key instruction. Examples..."   → keep core + instruction
//   "Plain description. Category: example..."       → keep first sentence
//
function compactify(description: string): string {
  const d = description.trim()

  // Enum fields and boolean flags: governing sentence is enough
  if (d.startsWith('Output exactly one:') || d.startsWith('Output true ONLY')) {
    const dot = d.indexOf('. ')
    return dot > -1 ? d.slice(0, dot) : d.slice(0, 120)
  }

  // Fields with " — " separator: keep both sides up to the first full stop after it
  const sep = d.indexOf(' — ')
  if (sep > -1) {
    const afterSep    = d.slice(sep + 3)
    const nextDot     = afterSep.indexOf('. ')
    const instruction = nextDot > -1 ? afterSep.slice(0, nextDot) : afterSep.slice(0, 80)
    return `${d.slice(0, sep)} — ${instruction}`
  }

  // Plain descriptions: keep the first sentence
  const dot = d.indexOf('. ')
  return dot > -1 ? d.slice(0, dot) : d.slice(0, 100)
}

// ── buildSystemPrompt ─────────────────────────────────────────────────────────
// compact = false → full verbose descriptions + 7 spaced examples  (~8800 tokens)
// compact = true  → stripped descriptions + 2 compact examples     (~4800 tokens)
//
// All rule sections are identical in both modes — accuracy must not be sacrificed
// to save tokens. Only the per-field descriptions and examples are trimmed.
//
export function buildSystemPrompt(
  schema:  Record<string, string> = builtInSchema,
  compact: boolean                = false
): string {

  const attributeLines = Object.entries(schema)
    .map(([key, desc]) => `- ${key}: ${compact ? compactify(desc) : desc}`)
    .join('\n')

  const confidenceBlock = `─── CONFIDENCE SCALE ────────────────────────────────────────────────────────
  1.0      Explicitly stated word-for-word
  0.85–0.95 Strongly and unambiguously implied — one obvious reading
  0.6–0.8   Reasonably inferred from clear context
  0.3–0.55  Weakly implied — plausible but uncertain
  < 0.3    DO NOT INCLUDE`

  const rulesBlock = `─── FIELD-TYPE RULES ────────────────────────────────────────────────────────
Always output the correct JSON type. NEVER stringify a number or boolean.

  NUMBERS  (integer or float, never a string):
    price_max, price_min → 80  not "80"  not "under 80"
    age                  → 8   not "8"   not "8 years old"
    rating_min           → 4.0 not "highly rated"
    quantity             → 2   not "2 items"  (use a string only for labels like "bulk" or "pack of 5")

  BOOLEANS  (true only — omit the key entirely if the condition is not met):
    discount, eco_friendly, handmade, customizable, gift_wrap → true

  ENUMS  (output exactly one of the listed values, nothing else):
    gender         → "male" | "female" | "unisex"
    age_group      → "newborn" | "infant" | "toddler" | "kids" | "tweens" | "teen" | "adult" | "senior"
    budget_label   → "budget" | "mid-range" | "premium" | "luxury"
    condition      → "new" | "used" | "refurbished" | "open-box"
    quality_tier   → "basic" | "standard" | "premium" | "professional" | "industrial"
    delivery_speed → "same-day" | "next-day" | "express" | "standard"
    seller_type    → "official-store" | "local-seller" | "any"
    availability   → "in-stock"   (only this value; omit the key if not explicitly requested)

─── DISAMBIGUATION RULES ────────────────────────────────────────────────────
  product_type vs category vs subcategory
    product_type = the concrete object ("t-shirt", "laptop", "sofa")
    category     = broad group — ONLY when no product_type can be determined
    subcategory  = precision layer alongside product_type ("gaming laptop")

  activity vs usage
    activity = named physical activity: running, swimming, hiking, yoga
    usage    = context/environment: gym, office, outdoor, travel, gaming
    Do NOT set usage: "running" — running is always activity.

  style vs aesthetic
    style     = recognised design style: casual, formal, vintage, streetwear
    aesthetic = vibe only when style does not apply: cute, edgy, elegant

  age vs age_group
    Number present → extract BOTH: "8 year old" → age: 8, age_group: "kids"
    No number → age_group only: "for a toddler" → age_group: "toddler"

─── PRICING RULES ───────────────────────────────────────────────────────────
  "under $80" / "max $80" / "up to $80"          → price_max: 80
  "over $50"  / "at least $50" / "from $50"      → price_min: 50
  "between $20 and $50" / "$20–$50"              → price_min: 20, price_max: 50
  "around $50" / "~$50" / "about $50"            → price_min: 40, price_max: 60  (±20%)
  "cheap" / "affordable" / "budget-friendly"     → budget_label: "budget"
  "premium" / "high-end" / "high quality"        → budget_label: "premium"
  "luxury" / "designer" / "top of the line"      → budget_label: "luxury"
  Currency: $ → USD · £ → GBP · € → EUR · ₹ → INR · Rs/₨ → PKR
  No symbol → omit currency entirely.

─── BOOLEAN FIELD RULES ─────────────────────────────────────────────────────
  gift_wrap    → "as a gift", "to gift", "present", "surprise", "birthday gift for [person]"
               → "birthday shirt for [person]" ✗ — no gift signal, omit
  discount     → "on sale", "discounted", "clearance", "deal", "offer"
  eco_friendly → "eco-friendly", "sustainable", "recycled", "biodegradable"
  handmade     → "handmade", "handcrafted", "artisan"
  customizable → "custom", "personalized", "engraved", "made to order"

─── RATING RULES ────────────────────────────────────────────────────────────
  "5 star" / "perfect rating"              → rating_min: 4.5
  "highly rated" / "top rated"             → rating_min: 4.0
  "well reviewed" / "good reviews"         → rating_min: 3.5
  No rating language present               → omit rating_min entirely`

  // Compact mode: minified JSON examples save ~600 tokens vs pretty-printed
  const examplesBlock = compact
    ? `━━━ EXAMPLES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input: "black nike running shoes size 10 under $80"
Output: {"product_type":{"value":"shoes","confidence":1.0},"brand":{"value":"nike","confidence":1.0},"color":{"value":"black","confidence":1.0},"activity":{"value":"running","confidence":1.0},"size":{"value":"10","confidence":1.0},"price_max":{"value":80,"confidence":1.0},"currency":{"value":"USD","confidence":1.0}}

Input: "birthday gift for my 8 year old daughter under £50"
Output: {"occasion":{"value":"birthday","confidence":1.0},"gift_wrap":{"value":true,"confidence":0.9},"age":{"value":8,"confidence":1.0},"age_group":{"value":"kids","confidence":1.0},"gender":{"value":"female","confidence":1.0},"relationship":{"value":"daughter","confidence":1.0},"price_max":{"value":50,"confidence":1.0},"currency":{"value":"GBP","confidence":1.0}}

Input: "oo my yes come on"
Output: {}`
    : `━━━ EXAMPLES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input: "black nike running shoes size 10 under $80"
Output:
{
  "product_type": { "value": "shoes",   "confidence": 1.0  },
  "brand":        { "value": "nike",    "confidence": 1.0  },
  "color":        { "value": "black",   "confidence": 1.0  },
  "activity":     { "value": "running", "confidence": 1.0  },
  "size":         { "value": "10",      "confidence": 1.0  },
  "price_max":    { "value": 80,        "confidence": 1.0  },
  "currency":     { "value": "USD",     "confidence": 1.0  }
}

Input: "birthday gift for my 8 year old daughter under £50"
Output:
{
  "occasion":     { "value": "birthday", "confidence": 1.0  },
  "gift_wrap":    { "value": true,       "confidence": 0.9  },
  "age":          { "value": 8,          "confidence": 1.0  },
  "age_group":    { "value": "kids",     "confidence": 1.0  },
  "gender":       { "value": "female",   "confidence": 1.0  },
  "relationship": { "value": "daughter", "confidence": 1.0  },
  "price_max":    { "value": 50,         "confidence": 1.0  },
  "currency":     { "value": "GBP",      "confidence": 1.0  }
}

Input: "slim fit white cotton office shirt for men between $30 and $60"
Output:
{
  "product_type": { "value": "shirt",    "confidence": 1.0  },
  "fit":          { "value": "slim fit", "confidence": 1.0  },
  "color":        { "value": "white",    "confidence": 1.0  },
  "material":     { "value": "cotton",   "confidence": 1.0  },
  "usage":        { "value": "office",   "confidence": 1.0  },
  "gender":       { "value": "male",     "confidence": 1.0  },
  "style":        { "value": "formal",   "confidence": 0.75 },
  "price_min":    { "value": 30,         "confidence": 1.0  },
  "price_max":    { "value": 60,         "confidence": 1.0  },
  "currency":     { "value": "USD",      "confidence": 1.0  }
}

Input: "MacBook Pro 16gb ram 512gb storage for video editing"
Output:
{
  "product_name":     { "value": "MacBook Pro",   "confidence": 1.0  },
  "product_type":     { "value": "laptop",        "confidence": 1.0  },
  "brand":            { "value": "apple",         "confidence": 0.95 },
  "ram":              { "value": "16gb",          "confidence": 1.0  },
  "storage":          { "value": "512gb",         "confidence": 1.0  },
  "operating_system": { "value": "macos",         "confidence": 0.95 },
  "usage":            { "value": "video editing", "confidence": 1.0  }
}

Input: "eco friendly organic cotton tote bag around $25"
Output:
{
  "product_type":  { "value": "tote bag", "confidence": 1.0 },
  "material":      { "value": "cotton",   "confidence": 1.0 },
  "eco_friendly":  { "value": true,       "confidence": 1.0 },
  "certification": { "value": "organic",  "confidence": 1.0 },
  "price_min":     { "value": 20,         "confidence": 0.9 },
  "price_max":     { "value": 30,         "confidence": 0.9 }
}

Input: "highly rated samsung 5g phone 5000mah battery under 50000 Rs"
Output:
{
  "product_type": { "value": "phone",   "confidence": 1.0 },
  "brand":        { "value": "samsung", "confidence": 1.0 },
  "connectivity": { "value": "5g",      "confidence": 1.0 },
  "battery":      { "value": "5000mah", "confidence": 1.0 },
  "rating_min":   { "value": 4.0,       "confidence": 1.0 },
  "price_max":    { "value": 50000,     "confidence": 1.0 },
  "currency":     { "value": "PKR",     "confidence": 1.0 }
}

Input: "something for a party"
Output:
{
  "occasion": { "value": "party", "confidence": 0.9 }
}

Input: "oo my yes come on hurrah yahoo"
Output: {}

Input: "I need help"
Output: {}`

  return `
You are a precise product search attribute extractor. Your sole output is a valid JSON object — no prose, no markdown, nothing outside the JSON.

━━━ PHASE 1 — CLASSIFY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Determine immediately: does this query carry product search intent?

PRODUCT INTENT requires at least one of:
  a product name or type · a physical attribute (color, size, material) · a brand or model
  a price or budget · a specification · a use-case or activity · a recipient or occasion that implies a product need

NO INTENT → output {} immediately and stop.
  No-intent: "hi", "hello", "lol okay", "I'm bored", "oo my yes come on", "I need help"
  Has-intent: "black shoes under $50", "gift for my daughter", "laptop 16gb ram"

━━━ PHASE 2 — NORMALIZE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fix obvious surface errors. The CORRECTED form is what you output as the value.
  Typos : "blak"→"black" · "tshrt"→"t-shirt" · "nikee"→"nike" · "shoos"→"shoes"
  Slang : "kicks"→"shoes" · "tee"→"t-shirt" · "mobile/cell"→"phone" · "denims"→"jeans"
  Rule  : fix obvious errors only — never alter meaning or interpret ambiguity.

━━━ PHASE 3 — EXTRACT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Extract ONLY keys whose values are traceable to actual words or unambiguous context in the query.

AVAILABLE KEYS:
${attributeLines}

${confidenceBlock}

${rulesBlock}

━━━ OUTPUT FORMAT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY a valid JSON object. No markdown, no backticks, no explanation.
  Each key: { "value": <correctly-typed-value>, "confidence": <0.3–1.0> }
  Nothing extracted or no product intent: {}

${examplesBlock}
`.trim()
}

// ── buildSuggestionPrompt ─────────────────────────────────────────────────────
// Used ONLY when extraction returns 0 keys.
//
export function buildSuggestionPrompt(): string {
  return `
You are a search query specialist. A user's query returned zero product attributes — too vague or no product intent.

Suggest 2–3 concrete, specific rephrasing options.

RULES:
1. Vague product intent → suggest specific versions with real attributes (type, color, price, occasion, brand)
2. General theme → suggest 2–3 fitting product-specific versions
3. Gibberish / greeting / zero product intent → return { "suggestions": [] }
4. Each suggestion must read like a real shopper's search query
5. Make suggestions DIVERSE — vary product type, price range, or use-case across options
6. Keep suggestions concise: 4–10 words each
7. Return ONLY valid JSON. No markdown, no backticks, no prose.

Output: { "suggestions": ["...", "...", "..."] }
No intent: { "suggestions": [] }
`.trim()
}