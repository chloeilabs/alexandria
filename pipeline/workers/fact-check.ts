// Fact-check pass for Tier 2 narratives.
//
// Per the plan: a separate Gemini call per Tier 2 entity that flags any
// claim not grounded in the sources. Failures route to the
// fact_check_reviews table; the entity page can surface them.
//
// Idempotent: re-running for an entity inserts a new review row but
// doesn't touch the narrative or the previous review history.
// Budget-gated via checkBudget.

import "../../lib/env";
import { generateText } from "ai";
import { eq } from "drizzle-orm";

import { db } from "../../lib/db";
import {
  entities,
  factCheckReviews,
  pipelineRuns,
  sources,
} from "../../lib/db/schema";
import {
  MODEL_FLASH,
  estimateCostUsd,
  roughTokensFromChars,
} from "../../lib/ai";
import {
  factCheckPrompt,
  type FactCheckOutput,
} from "../../lib/ai/prompts/fact-check";
import { corroborateClaim, type ClaimCorroboration } from "../../lib/openalex";
import { checkBudget } from "../budget";

const SOURCE_CHAR_BUDGET = 9_000;

// Opt-out: set DISABLE_OPENALEX_CORROBORATION=1 to skip the corroboration
// step (e.g. for A/B comparing fact-check output before/after corroboration).
const OPENALEX_DISABLED =
  process.env.DISABLE_OPENALEX_CORROBORATION === "1";

// Hard cap on how many findings get corroborated per entity. The
// fact-check pass usually surfaces 0–4 findings; this guard protects
// against pathological narratives generating dozens of flags.
const MAX_CORROBORATIONS_PER_ENTITY = 8;

export interface FactCheckResult {
  qid: string;
  status: "ok" | "clean" | "flagged" | "no_narrative" | "no_sources";
  findings?: Array<
    FactCheckOutput["findings"][number] & {
      corroboration?: ClaimCorroboration;
    }
  >;
  costUsd?: number;
}

export async function factCheckEntity(qid: string): Promise<FactCheckResult> {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.qid, qid))
    .limit(1);
  if (!entity) return { qid, status: "no_narrative" };
  if (!entity.narrative || entity.tier < 2) {
    return { qid, status: "no_narrative" };
  }

  const srcRows = await db
    .select()
    .from(sources)
    .where(eq(sources.entityQid, qid));
  if (srcRows.length === 0) return { qid, status: "no_sources" };

  const narrateSources = srcRows
    .filter(
      (s) =>
        s.sourceKind === "wikipedia" ||
        s.sourceKind === "britannica_1911" ||
        s.sourceKind === "sep",
    )
    .map((s) => ({
      kind: s.sourceKind as "wikipedia" | "britannica_1911" | "sep",
      url: s.url ?? undefined,
      content: s.content.slice(0, SOURCE_CHAR_BUDGET),
    }));
  if (narrateSources.length === 0) return { qid, status: "no_sources" };

  const params = factCheckPrompt({
    name: entity.name,
    narrative: entity.narrative,
    sources: narrateSources,
  });

  const estimatedInputTokens = roughTokensFromChars(
    params.system.length + params.prompt.length,
  );
  const estimatedCost = estimateCostUsd(
    MODEL_FLASH,
    estimatedInputTokens,
    params.maxOutputTokens,
  );
  await checkBudget(estimatedCost);

  const t0 = Date.now();
  const result = await generateText(params);

  // ai-sdk returns the parsed object via `experimental_output` when Output
  // schema is set; new ai 6.x exposes it via result.experimental_output.
  // The getter THROWS NoOutputGeneratedError if the model returned no
  // structured output (e.g. when narratives are very long and the model
  // omits the JSON). Catch and fall back to text-JSON parse.
  type ResultWithOutput = typeof result & {
    experimental_output?: FactCheckOutput;
    output?: FactCheckOutput;
  };
  const r2 = result as ResultWithOutput;
  let parsed: FactCheckOutput | undefined;
  try {
    parsed = r2.experimental_output ?? r2.output;
  } catch {
    parsed = undefined;
  }

  let findings: FactCheckOutput["findings"];
  if (parsed && Array.isArray(parsed.findings)) {
    findings = parsed.findings;
  } else {
    // Fallback: try to parse the text response as JSON.
    try {
      const m = result.text.match(/\{[\s\S]*\}/);
      if (m) {
        const obj = JSON.parse(m[0]) as FactCheckOutput;
        findings = Array.isArray(obj.findings) ? obj.findings : [];
      } else {
        findings = [];
      }
    } catch {
      findings = [];
    }
  }

  const status = findings.length === 0 ? "clean" : "flagged";
  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const actualCost = estimateCostUsd(MODEL_FLASH, inputTokens, outputTokens);

  // Corroborate each finding against OpenAlex's ~315M scholarly works.
  // A finding the model "flagged as missing" that actually has 25+ cited
  // peer-reviewed works behind it is a near-certain false positive —
  // worth surfacing so editorial review can deprioritise. Idempotent
  // per-run, additive-only to the flagged_claims payload; no schema
  // change.
  type EnrichedFinding = FactCheckOutput["findings"][number] & {
    corroboration?: ClaimCorroboration;
  };
  let enrichedFindings: EnrichedFinding[] = findings;
  if (!OPENALEX_DISABLED && findings.length > 0) {
    enrichedFindings = await Promise.all(
      findings.slice(0, MAX_CORROBORATIONS_PER_ENTITY).map(async (f) => {
        try {
          // No year filter — corroboration wants modern scholarship ABOUT
          // the subject, not primary sources FROM their lifetime. The
          // entity's BCE dates would also silently break the filter.
          const corroboration = await corroborateClaim(entity.name, f.claim, {
            limit: 3,
          });
          return { ...f, corroboration };
        } catch (err) {
          console.warn(
            `[fact-check] openalex corroboration failed for ${qid} claim "${f.claim.slice(0, 60)}…"`,
            err,
          );
          return f;
        }
      }),
    );
    // Append any findings past the cap unchanged so we never drop data.
    if (findings.length > MAX_CORROBORATIONS_PER_ENTITY) {
      enrichedFindings = enrichedFindings.concat(
        findings.slice(MAX_CORROBORATIONS_PER_ENTITY),
      );
    }
  }

  await db.transaction(async (tx) => {
    await tx.insert(factCheckReviews).values({
      entityQid: qid,
      model: MODEL_FLASH,
      status,
      flaggedClaims: enrichedFindings,
    });
    await tx.insert(pipelineRuns).values({
      jobKind: "fact-check",
      startedAt: new Date(t0),
      finishedAt: new Date(),
      entitiesProcessed: 1,
      apiCostUsd: actualCost.toString(),
      status: "completed",
    });
  });

  return { qid, status, findings: enrichedFindings, costUsd: actualCost };
}
