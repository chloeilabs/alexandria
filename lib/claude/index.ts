// Anthropic SDK client + model + pricing constants.
// All Claude calls in the project flow through this module.

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  // Warn but don't fail — typecheck and test scripts can import this
  // module without making API calls. Workers that actually call the API
  // will error on first call if the key is missing.
  if (process.env.NODE_ENV !== "test") {
    console.warn(
      "[claude] ANTHROPIC_API_KEY is not set in .env.local — API calls will fail",
    );
  }
}

export const claude = new Anthropic({
  apiKey: apiKey ?? "",
});

// Versioned model identifiers — never use aliases.
// Cross-check pricing if these change.
export const MODEL_HAIKU = "claude-haiku-4-5-20251001";
export const MODEL_SONNET = "claude-sonnet-4-6";
export const MODEL_OPUS = "claude-opus-4-7";

export type Model = typeof MODEL_HAIKU | typeof MODEL_SONNET | typeof MODEL_OPUS;

/**
 * USD per million tokens, as of 2026-05.
 * Update DECISIONS.md + this constant when re-baselining.
 */
export const PRICING: Record<Model, { input: number; output: number }> = {
  [MODEL_HAIKU]: { input: 1.0, output: 5.0 },
  [MODEL_SONNET]: { input: 3.0, output: 15.0 },
  [MODEL_OPUS]: { input: 15.0, output: 75.0 },
};

export function estimateCostUsd(
  model: Model,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

/**
 * Rough char→token estimate (Anthropic tokenizer is roughly 3.5 chars/token
 * for English; we use 3 to be conservative for budget guardrails).
 */
export function roughTokensFromChars(chars: number): number {
  return Math.ceil(chars / 3);
}
