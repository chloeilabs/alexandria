// AI Gateway client + model + pricing constants.
//
// We route through Vercel AI Gateway (DECISIONS.md, 2026-05-22) so the
// model can be swapped via a single string. AI_GATEWAY_API_KEY in
// .env.local; the gateway is the default global provider, so a plain
// model string ("google/gemini-3.5-flash") just works.
//
// Update PRICING when re-baselining; current values fetched from
// https://ai-gateway.vercel.sh/v1/models (2026-05-24).

import "../env";

if (!process.env.AI_GATEWAY_API_KEY && process.env.NODE_ENV !== "test") {
  console.warn(
    "[ai] AI_GATEWAY_API_KEY is not set in .env.local — API calls will fail",
  );
}

// Default model for Tier 1 summaries and single-source Tier 2 narratives.
// $1.50/M input, $9/M output, 1M-token context window.
export const MODEL_FLASH = "google/gemini-3.5-flash";

// MODEL_PRO collapsed to MODEL_FLASH (2026-05-24 bake-off v2 verdict).
// Qwen3.7-max scored +2 on the AAI intelligence index but produced
// reasoning tokens that pushed billed output 1.34× over Flash even with
// `reasoning: { effort: 'none' }` set (Vercel AI Gateway's per-provider
// reasoning suppression doesn't cover Qwen as of 2026-03-07 docs). Flash
// wins on $/quality; one model everywhere is also simpler. Exported as
// a separate constant for downstream call-site compat — flip the value
// here to re-enable tiering if a future model swap argues for it.
export const MODEL_PRO = MODEL_FLASH;

// Fallback chain via AI Gateway's `providerOptions.gateway.models`. If
// the primary upstream is throttled or fails, the gateway tries the
// next in order. Keeps the encyclopedia generating even during single-
// provider outages.
export const NARRATE_MODELS: string[] = [MODEL_FLASH];

export type Model = typeof MODEL_FLASH | typeof MODEL_PRO;

/**
 * USD per million tokens. Refresh via the gateway's models endpoint:
 *   curl -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \
 *     https://ai-gateway.vercel.sh/v1/models
 */
export const PRICING: Record<string, { input: number; output: number }> = {
  [MODEL_FLASH]: { input: 1.5, output: 9.0 },
};

/**
 * Pick a model for a tier. Tier 3 hand-curation and multi-source Tier 2
 * narrates route to Pro; everything else stays on Flash. Used by the
 * narrate worker and Tier 3 scripts; budget gate handles the cost
 * difference automatically since PRICING is per-model.
 */
export function chooseModel(
  tier: 1 | 2 | 3,
  hasMultiSource: boolean,
): typeof MODEL_FLASH | typeof MODEL_PRO {
  if (tier === 3) return MODEL_PRO;
  if (tier === 2 && hasMultiSource) return MODEL_PRO;
  return MODEL_FLASH;
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------
//
// Voyage 4 large: newer-generation 1024-default cosine-friendly embeddings.
// Drop-in for `entities.embedding vector(1024)` — no schema change. $0.12
// per million tokens through the Vercel AI Gateway (vs $0.18 for the
// retired voyage-3-large), and "all embeddings created with the 4 series
// are compatible with each other" (per gateway model card), so a future
// step down to voyage-4 ($0.06/M) or voyage-4-lite ($0.02/M) for cost
// discipline is a one-string change. Note: Voyage's account-level 200M
// free-tier allowance is NOT exposed through the gateway — it's
// pay-as-you-go from token one here. Re-embed cost for ~376 entities
// is ~$0.02 regardless.

export const MODEL_EMBED = "voyage/voyage-4-large";
export const EMBED_DIMENSIONS = 1024;
/** USD per million tokens for the embedding model. */
export const EMBED_PRICE_PER_M = 0.12;

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
