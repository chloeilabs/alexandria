// Thin wrappers around the Vercel AI SDK.
//
// All calls route through the AI Gateway. AI SDK v6 requires the
// `gateway(...)` provider wrapper to be explicit — plain string model ids
// no longer auto-route reliably even with AI_GATEWAY_API_KEY set. The
// `gateway` provider is bundled into the `ai` package itself (≥5.0.36),
// so we import it from there rather than the standalone `@ai-sdk/gateway`
// package — fewer dependencies and no separate version to keep in sync.

import "../env";
import { embed as aiEmbed, gateway, generateObject, generateText } from "ai";
import type { z } from "zod";

import {
  MODEL_CLAUDE_HAIKU,
  MODEL_DEEPSEEK_V4_PRO,
  MODEL_EMBED,
} from "./index";

// Generator and verifier are intentionally from different model families.
// Same-model verification (Gemini × Gemini, Grok × Grok, etc.) is sampling
// variance, not real consensus — the verifier inherits the generator's
// blind spots. DeepSeek V4 Pro (MoE, DeepSeek training) generates;
// Claude Haiku 4.5 (Anthropic RLHF, hedges/flags uncertainty more
// readily) verifies. Disagreements caught by the verifier therefore
// reflect cross-family disagreement, which is what `consensus_score`
// is supposed to measure.
export const DEFAULT_GENERATOR = MODEL_DEEPSEEK_V4_PRO;
export const DEFAULT_VERIFIER = MODEL_CLAUDE_HAIKU;

export interface GenerateObjectUsage {
  promptTokens: number;
  completionTokens: number;
}

export async function generateStructured<T>(args: {
  schema: z.ZodType<T>;
  prompt: string;
  model?: string;
  system?: string;
  temperature?: number;
}): Promise<{ object: T; usage: GenerateObjectUsage; model: string }> {
  const model = args.model ?? DEFAULT_GENERATOR;
  const result = await generateObject({
    model: gateway(model),
    schema: args.schema,
    prompt: args.prompt,
    system: args.system,
    temperature: args.temperature ?? 0.4,
  });
  return {
    object: result.object,
    usage: {
      promptTokens: result.usage?.inputTokens ?? 0,
      completionTokens: result.usage?.outputTokens ?? 0,
    },
    model,
  };
}

export async function generatePlainText(args: {
  prompt: string;
  model?: string;
  system?: string;
  temperature?: number;
}): Promise<{ text: string; usage: GenerateObjectUsage; model: string }> {
  const model = args.model ?? DEFAULT_GENERATOR;
  const result = await generateText({
    model: gateway(model),
    prompt: args.prompt,
    system: args.system,
    temperature: args.temperature ?? 0.4,
  });
  return {
    text: result.text,
    usage: {
      promptTokens: result.usage?.inputTokens ?? 0,
      completionTokens: result.usage?.outputTokens ?? 0,
    },
    model,
  };
}

export async function embed(text: string): Promise<{
  embedding: number[];
  tokens: number;
  model: string;
}> {
  const result = await aiEmbed({
    model: gateway.textEmbeddingModel(MODEL_EMBED),
    value: text,
  });
  return {
    embedding: result.embedding,
    tokens: result.usage?.tokens ?? 0,
    model: MODEL_EMBED,
  };
}
