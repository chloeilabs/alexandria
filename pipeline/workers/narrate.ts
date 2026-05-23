// Tier 1 → Tier 2 worker.
// For now uses single-source synthesis (Wikipedia full extract). Multi-source
// (Wikipedia + 1911 Britannica + others) is a planned follow-up; the
// narrate prompt already accepts an array of sources so the upgrade is
// just wiring more fetchers.
//
// Idempotent: skips entities already at Tier 2+.
// Budget-gated: cost estimated before the call.

import "../../lib/env";
import { generateText } from "ai";
import { eq } from "drizzle-orm";

import { db } from "../../lib/db";
import {
  entities,
  pipelineRuns,
  sources,
} from "../../lib/db/schema";
import {
  MODEL_FLASH,
  estimateCostUsd,
  roughTokensFromChars,
} from "../../lib/ai";
import {
  narratePrompt,
  type NarrateSource,
} from "../../lib/ai/prompts/narrate";
import { fetchPlaintext } from "../../lib/wikipedia";
import { checkBudget } from "../budget";

const WIKIPEDIA_NARRATE_CHAR_BUDGET = 12_000;

export interface NarrateResult {
  qid: string;
  status: "ok" | "no_source" | "already_done" | "not_found" | "wrong_tier";
  narrative?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export async function narrateEntity(qid: string): Promise<NarrateResult> {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.qid, qid))
    .limit(1);

  if (!entity) return { qid, status: "not_found" };
  if (entity.tier >= 2 && entity.narrative) {
    return { qid, status: "already_done" };
  }
  // We require the entity to already be at Tier 1 (summary present) so we
  // don't accidentally narrate something with no Wikipedia source yet.
  if (entity.tier < 1) return { qid, status: "wrong_tier" };

  // Prefer a stored wikipedia source row; fall back to a fresh fetch.
  const [storedSrc] = await db
    .select()
    .from(sources)
    .where(eq(sources.entityQid, qid))
    .limit(1);

  let sourceText: string;
  let sourceUrl: string;

  if (storedSrc && storedSrc.sourceKind === "wikipedia" && storedSrc.content) {
    sourceText = storedSrc.content;
    sourceUrl = storedSrc.url ?? "";
  } else {
    const article = await fetchPlaintext(entity.name);
    if (!article || article.extract.length < 400) {
      return { qid, status: "no_source" };
    }
    sourceText = article.extract;
    sourceUrl = article.url;
    // Persist for re-use
    await db
      .insert(sources)
      .values({
        entityQid: qid,
        sourceKind: "wikipedia",
        url: sourceUrl,
        content: sourceText,
        license: "CC BY-SA 4.0",
      })
      .onConflictDoNothing({
        target: [sources.entityQid, sources.sourceKind],
      });
  }

  const trimmed = sourceText.slice(0, WIKIPEDIA_NARRATE_CHAR_BUDGET);

  const narrateSources: NarrateSource[] = [
    {
      kind: "wikipedia",
      url: sourceUrl,
      content: trimmed,
    },
  ];

  const params = narratePrompt({
    name: entity.name,
    type: entity.type,
    dateStart: entity.dateStart,
    dateEnd: entity.dateEnd,
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

  const narrative = result.text.trim();
  if (!narrative) {
    throw new Error(`AI Gateway returned no narrative text for ${qid}`);
  }

  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const actualCost = estimateCostUsd(MODEL_FLASH, inputTokens, outputTokens);

  await db.transaction(async (tx) => {
    await tx
      .update(entities)
      .set({
        narrative,
        sourceAttribution: {
          sources: [
            { kind: "wikipedia", url: sourceUrl, license: "CC BY-SA 4.0" },
          ],
        },
        tier: 2,
        tierUpgradedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(entities.qid, qid));

    await tx.insert(pipelineRuns).values({
      jobKind: "narrate",
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
    narrative,
    costUsd: actualCost,
    inputTokens,
    outputTokens,
  };
}
