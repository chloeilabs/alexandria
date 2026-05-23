// Tier 0 → Tier 1 worker via AI Gateway (DECISIONS.md, 2026-05-22).
//
// Idempotent: if an entity is already at Tier 1+, returns "skipped".
// Budget-gated: every call estimates cost and aborts if DAILY_BUDGET_USD
// would be breached.

import "../../lib/env";
import { generateText } from "ai";
import { eq } from "drizzle-orm";

import { db } from "../../lib/db";
import { entities, pipelineRuns, sources } from "../../lib/db/schema";
import {
  MODEL_FLASH,
  estimateCostUsd,
  roughTokensFromChars,
} from "../../lib/ai";
import { summarizePrompt } from "../../lib/ai/prompts/summarize";
import { fetchPlaintext } from "../../lib/wikipedia";
import { checkBudget } from "../budget";

const WIKIPEDIA_LEAD_CHAR_BUDGET = 3000;

export interface SummarizeResult {
  qid: string;
  status: "ok" | "no_source" | "already_done" | "not_found";
  summary?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export async function summarizeEntity(qid: string): Promise<SummarizeResult> {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.qid, qid))
    .limit(1);

  if (!entity) return { qid, status: "not_found" };
  if (entity.tier >= 1 && entity.summary) {
    return { qid, status: "already_done" };
  }

  const article = await fetchPlaintext(entity.name);
  if (!article || article.extract.length < 200) {
    return { qid, status: "no_source" };
  }

  await db
    .insert(sources)
    .values({
      entityQid: qid,
      sourceKind: "wikipedia",
      url: article.url,
      content: article.extract,
      license: "CC BY-SA 4.0",
    })
    .onConflictDoNothing({
      target: [sources.entityQid, sources.sourceKind],
    });

  const intro = article.extract.slice(0, WIKIPEDIA_LEAD_CHAR_BUDGET);

  const params = summarizePrompt({
    name: entity.name,
    type: entity.type,
    dateStart: entity.dateStart,
    dateEnd: entity.dateEnd,
    wikipediaIntro: intro,
  });

  // Budget guard — estimate before the call.
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

  const summary = result.text.trim();
  if (!summary) {
    throw new Error(`AI Gateway returned no text for ${qid}`);
  }

  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const actualCost = estimateCostUsd(MODEL_FLASH, inputTokens, outputTokens);

  await db.transaction(async (tx) => {
    await tx
      .update(entities)
      .set({
        summary,
        sourceAttribution: {
          sources: [
            {
              kind: "wikipedia",
              url: article.url,
              license: "CC BY-SA 4.0",
            },
          ],
        },
        tier: 1,
        tierUpgradedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(entities.qid, qid));

    await tx.insert(pipelineRuns).values({
      jobKind: "summarize",
      startedAt: new Date(t0),
      finishedAt: new Date(),
      entitiesProcessed: 1,
      apiCostUsd: actualCost.toString(),
      status: "completed",
    });
  });

  return {
    qid,
    status: "ok",
    summary,
    costUsd: actualCost,
    inputTokens,
    outputTokens,
  };
}
