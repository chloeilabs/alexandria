// Tier 0 → Tier 1 worker: fetches Wikipedia source, runs the summarize
// prompt against Haiku, persists the result.
//
// Idempotent: if an entity is already at Tier 1+, returns "skipped".
// Budget-gated: every call estimates cost and aborts if DAILY_BUDGET_USD
// would be breached.

import "dotenv/config";
import { eq } from "drizzle-orm";

import { db } from "../../lib/db";
import { entities, pipelineRuns, sources } from "../../lib/db/schema";
import {
  MODEL_HAIKU,
  claude,
  estimateCostUsd,
  roughTokensFromChars,
} from "../../lib/claude";
import { summarizePrompt } from "../../lib/claude/prompts/summarize";
import { fetchPlaintext } from "../../lib/wikipedia";
import { checkBudget } from "../budget";

const WIKIPEDIA_LEAD_CHAR_BUDGET = 3000;

export interface SummarizeResult {
  qid: string;
  status:
    | "ok"
    | "no_source" // Wikipedia didn't return an article
    | "already_done" // Entity already at Tier 1+
    | "not_found"; // QID isn't in our DB
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

  // Persist the source first — even if Claude fails, we keep the text
  // for retries and for the eventual Tier 2 narrate job.
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
    (params.system as string).length +
      intro.length +
      entity.name.length +
      120,
  );
  const estimatedOutputTokens = params.max_tokens;
  const estimatedCost = estimateCostUsd(
    MODEL_HAIKU,
    estimatedInputTokens,
    estimatedOutputTokens,
  );
  await checkBudget(estimatedCost);

  const t0 = Date.now();
  const response = await claude.messages.create(params);

  const summary = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter((s) => s.length > 0)
    .join("\n\n")
    .trim();

  if (!summary) {
    throw new Error(`Claude returned no text for ${qid}`);
  }

  const actualCost = estimateCostUsd(
    MODEL_HAIKU,
    response.usage.input_tokens,
    response.usage.output_tokens,
  );

  // Persist summary + tier upgrade + log spend, all in one transaction.
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
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
