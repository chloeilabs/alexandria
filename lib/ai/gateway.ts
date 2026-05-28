// Thin wrappers around the Vercel AI SDK.
//
// All calls route through the AI Gateway. With AI_GATEWAY_API_KEY set,
// passing a plain string model id ("google/gemini-3.5-flash") to
// generateObject/generateText is enough — no provider import.
//
// For embeddings we use the typed gateway provider so the model id is
// checked at the type level.

import "../env";
import { embed as aiEmbed, generateObject, generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import type { z } from "zod";

import { MODEL_EMBED, MODEL_FLASH } from "./index";

export const DEFAULT_GENERATOR = MODEL_FLASH;
export const DEFAULT_VERIFIER = MODEL_FLASH;

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
    model,
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
    model,
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
