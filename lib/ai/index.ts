// AI Gateway client + model + pricing constants.
//
// We route through Vercel AI Gateway (DECISIONS.md, 2026-05-22) so the
// model can be swapped via a single string. AI_GATEWAY_API_KEY in
// .env.local; the gateway is the default global provider, so a plain
// model string ("google/gemini-3.5-flash") just works.
//
// Update PRICING when re-baselining; current values fetched from
// https://ai-gateway.vercel.sh/v1/models (2026-05-22).

import "../env";

if (!process.env.AI_GATEWAY_API_KEY && process.env.NODE_ENV !== "test") {
  console.warn(
    "[ai] AI_GATEWAY_API_KEY is not set in .env.local — API calls will fail",
  );
}

// Default model for all tiers. The user opted into Gemini 3.5 Flash:
// $1.50/M input, $9/M output, 1M-token context window — meaningfully
// cheaper than Sonnet for our volume. Swap by changing this constant.
export const MODEL_FLASH = "google/gemini-3.5-flash";

// Reserved for the curated tier if/when we want a stronger model.
// Current default Flash is fine for Tier 1+2; this is here so the
// budget tracker can distinguish if we later use multiple models.
export const MODEL_PRO = "google/gemini-3.5-flash"; // intentionally same for now

export type Model = typeof MODEL_FLASH | typeof MODEL_PRO;

/**
 * USD per million tokens, fetched 2026-05-22 from AI Gateway model listing.
 */
export const PRICING: Record<string, { input: number; output: number }> = {
  [MODEL_FLASH]: { input: 1.5, output: 9.0 },
};

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------
//
// Voyage 3 large: 1024-dimensional cosine-friendly embeddings. Exact match
// for our `entities.embedding vector(1024)` column. $0.18 per million tokens
// (no separate output cost — embedding endpoints are flat-rate).

export const MODEL_EMBED = "voyage/voyage-3-large";
export const EMBED_DIMENSIONS = 1024;
/** USD per million tokens for the embedding model. */
export const EMBED_PRICE_PER_M = 0.18;

export function estimateEmbedCostUsd(tokens: number): number {
  return (tokens / 1_000_000) * EMBED_PRICE_PER_M;
}

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model];
  if (!p) {
    // Unknown model — return 0 to avoid blocking; log a warning.
    console.warn(`[ai] no pricing for model "${model}"; assuming free`);
    return 0;
  }
  return (
    (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
  );
}

/**
 * Rough char→token estimate, used by checkBudget BEFORE the call.
 * ~3 chars/token is a conservative estimate for English (true ratio
 * ~3.5-4 for most tokenizers).
 */
export function roughTokensFromChars(chars: number): number {
  return Math.ceil(chars / 3);
}
