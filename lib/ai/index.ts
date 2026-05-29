// Model identifiers, pricing, and cost-estimation helpers.
//
// Inference goes through the Vercel AI Gateway. With AI_GATEWAY_API_KEY
// set, a plain model-id string ("google/gemini-3.5-flash") is enough —
// no provider import needed. Refresh pricing periodically:
//   curl -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \
//     https://ai-gateway.vercel.sh/v1/models

import "../env";

if (!process.env.AI_GATEWAY_API_KEY && process.env.NODE_ENV !== "test") {
  console.warn(
    "[ai] AI_GATEWAY_API_KEY is not set in .env.local — API calls will fail",
  );
}

// Model ids — names match Vercel AI Gateway's `/v1/models` exactly.
export const MODEL_FLASH = "google/gemini-3.5-flash";
export const MODEL_DEEPSEEK_V4_PRO = "deepseek/deepseek-v4-pro";
export const MODEL_DEEPSEEK_V4_FLASH = "deepseek/deepseek-v4-flash";
export const MODEL_CLAUDE_HAIKU = "anthropic/claude-haiku-4.5";

/** USD per million tokens. Refresh via `/v1/models` on the gateway. */
export const PRICING: Record<string, { input: number; output: number }> = {
  [MODEL_FLASH]: { input: 1.5, output: 9.0 },
  [MODEL_DEEPSEEK_V4_PRO]: { input: 0.43, output: 0.87 },
  [MODEL_DEEPSEEK_V4_FLASH]: { input: 0.14, output: 0.28 },
  [MODEL_CLAUDE_HAIKU]: { input: 1.0, output: 5.0 },
};

export const MODEL_EMBED = "voyage/voyage-4-large";
export const EMBED_DIMENSIONS = 1024;
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
    console.warn(`[ai] no pricing for model "${model}"; assuming free`);
    return 0;
  }
  return (
    (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
  );
}

/** ~3 chars/token is a conservative estimate for English. */
export function roughTokensFromChars(chars: number): number {
  return Math.ceil(chars / 3);
}
