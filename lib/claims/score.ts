// Per-claim factuality via semantic entropy (Farquhar et al., Nature 2024),
// adapted for an AI-distilled corpus with no ground-truth source.
//
// Pipeline per entity:
//   1. decompose the narrative into atomic, checkable claims + bare questions
//   2. for each claim, sample the *generator* N times on the bare question
//      with no access to the entry (fresh context, temperature > 0)
//   3. judge how many DISTINCT factual answers appear and whether the
//      majority supports the entry's claim
//   4. scattered answers → high semantic entropy → likely confabulation
//
// Structured calls (decompose, judge) use the verifier model (Claude Haiku —
// non-reasoning, reliable structured output). Sampling uses the generator
// (DeepSeek V4 Pro) because we are measuring *its* consistency: the entry was
// written by the generator, so generator self-consistency is the signal.

import { z } from "zod";

import {
  DEFAULT_GENERATOR,
  DEFAULT_VERIFIER,
  generatePlainText,
  generateStructured,
} from "../ai/gateway";
import type { ClaimVerdict } from "../db/schema";

export interface ScoredClaim {
  claim: string;
  question: string;
  nSamples: number;
  distinctAnswers: number;
  entropy: number;
  verdict: ClaimVerdict;
  majorityAnswer: string;
  agreesWithClaim: boolean;
}

/** Token usage accumulated per model id, so the caller can cost + log it. */
export type UsageByModel = Record<
  string,
  { promptTokens: number; completionTokens: number }
>;

export interface EntityClaimScore {
  claims: ScoredClaim[];
  /** Fraction of claims that came back "corroborated" (0–1). */
  factualityScore: number;
  usageByModel: UsageByModel;
}

function addUsage(
  acc: UsageByModel,
  model: string,
  u: { promptTokens: number; completionTokens: number },
): void {
  const cur = acc[model] ?? { promptTokens: 0, completionTokens: 0 };
  cur.promptTokens += u.promptTokens;
  cur.completionTokens += u.completionTokens;
  acc[model] = cur;
}

export interface ScoreOptions {
  maxClaims?: number;
  nSamples?: number;
  /** Model used for sampling — defaults to the generator (whose consistency we test). */
  sampleModel?: string;
  /** Model used for the structured decompose + judge steps. */
  judgeModel?: string;
}

const decomposeSchema = z.object({
  claims: z
    .array(
      z.object({
        claim: z
          .string()
          .describe("A single atomic factual assertion drawn from the text."),
        question: z
          .string()
          .describe(
            "The bare question this claim answers, revealing none of the answer.",
          ),
      }),
    )
    .max(12),
});

const judgeSchema = z.object({
  distinctAnswers: z
    .number()
    .int()
    .min(1)
    .describe("Count of genuinely distinct factual answers across the samples."),
  majorityAgreesWithClaim: z.boolean(),
  majorityAnswer: z.string(),
  verdict: z.enum(["corroborated", "uncertain", "contradicted"]),
});

/** Normalized entropy proxy: 0 when all samples agree, →1 as answers scatter. */
export function entropyFromClusters(distinct: number, n: number): number {
  if (n <= 1) return 0;
  return Math.min(1, Math.max(0, (distinct - 1) / (n - 1)));
}

export async function decomposeClaims(
  name: string,
  narrative: string,
  opts: ScoreOptions = {},
  usage?: UsageByModel,
): Promise<{ claim: string; question: string }[]> {
  const maxClaims = opts.maxClaims ?? 8;
  const judgeModel = opts.judgeModel ?? DEFAULT_VERIFIER;
  const r = await generateStructured({
    model: judgeModel,
    schema: decomposeSchema,
    system:
      "You extract atomic, independently-checkable factual claims from an encyclopedia entry. Prefer specific, falsifiable assertions (dates, names, numbers, causal links) over vague or evaluative statements.",
    prompt: `Extract up to ${maxClaims} of the most check-worthy atomic factual claims from this entry about ${name}. For each, write the bare question it answers WITHOUT revealing the answer.\n\n${narrative.slice(0, 8000)}`,
  });
  if (usage) addUsage(usage, r.model, r.usage);
  return r.object.claims.slice(0, maxClaims);
}

export async function scoreClaim(
  claim: string,
  question: string,
  opts: ScoreOptions = {},
  usage?: UsageByModel,
): Promise<ScoredClaim> {
  const nSamples = opts.nSamples ?? 5;
  const sampleModel = opts.sampleModel ?? DEFAULT_GENERATOR;

  const samples: string[] = [];
  for (let i = 0; i < nSamples; i++) {
    const r = await generatePlainText({
      model: sampleModel,
      prompt: `Answer in one short factual sentence. ${question}`,
      temperature: 0.8,
    });
    if (usage) addUsage(usage, r.model, r.usage);
    samples.push(r.text.trim().replace(/\s+/g, " "));
  }

  const r = await generateStructured({
    model: opts.judgeModel ?? DEFAULT_VERIFIER,
    schema: judgeSchema,
    system:
      "You assess whether independently-sampled answers agree. Cluster answers that assert the same fact (ignoring wording differences). Then decide if the majority supports the target claim. Be precise: a different date, name, or number is a distinct answer.",
    prompt: `Target claim: "${claim}"\n\nIndependent samples answering "${question}":\n${samples
      .map((s, k) => `${k + 1}. ${s}`)
      .join("\n")}\n\nHow many DISTINCT factual answers are there? Does the majority agree with the target claim?`,
  });
  if (usage) addUsage(usage, r.model, r.usage);
  const j = r.object;

  return {
    claim,
    question,
    nSamples,
    distinctAnswers: j.distinctAnswers,
    entropy: entropyFromClusters(j.distinctAnswers, nSamples),
    verdict: j.verdict as ClaimVerdict,
    majorityAnswer: j.majorityAnswer,
    agreesWithClaim: j.majorityAgreesWithClaim,
  };
}

export async function scoreEntityClaims(
  entity: { canonicalName: string; narrative: string },
  opts: ScoreOptions = {},
): Promise<EntityClaimScore> {
  const usageByModel: UsageByModel = {};
  const decomposed = await decomposeClaims(
    entity.canonicalName,
    entity.narrative,
    opts,
    usageByModel,
  );

  const claims: ScoredClaim[] = [];
  for (const c of decomposed) {
    claims.push(await scoreClaim(c.claim, c.question, opts, usageByModel));
  }

  const corroborated = claims.filter((c) => c.verdict === "corroborated").length;
  const factualityScore = claims.length > 0 ? corroborated / claims.length : 0;

  return { claims, factualityScore, usageByModel };
}
