// Civilizational-tag classifier worker.
// Reads name/type/dates/coords/aliases for an entity, asks Flash to assign
// 0-3 tags from the closed civilizational taxonomy, persists to
// entity_regions with region_kind='civilizational'.

import "../../lib/env";
import { generateText } from "ai";
import { eq } from "drizzle-orm";

import { db } from "../../lib/db";
import {
  entities,
  entityAliases,
  entityRegions,
  pipelineRuns,
  relationships,
} from "../../lib/db/schema";
import {
  MODEL_FLASH,
  estimateCostUsd,
  roughTokensFromChars,
} from "../../lib/ai";
import { classifyCivilizationPrompt } from "../../lib/ai/prompts/classify-civilization";
import { checkBudget } from "../budget";

export interface TagResult {
  qid: string;
  status: "ok" | "not_found" | "no_tags" | "skipped";
  tags?: string[];
  rationale?: string;
  costUsd?: number;
}

export async function classifyEntity(qid: string): Promise<TagResult> {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.qid, qid))
    .limit(1);
  if (!entity) return { qid, status: "not_found" };

  // Aliases for disambiguation (a few English + foreign-script names).
  const aliasRows = await db
    .select({ alias: entityAliases.alias })
    .from(entityAliases)
    .where(eq(entityAliases.entityQid, qid))
    .limit(8);

  // P17 country, if we captured it as a relationship during ingestion.
  const p17Rows = await db
    .select({ targetQid: relationships.targetQid })
    .from(relationships)
    .where(eq(relationships.sourceQid, qid))
    .limit(50);
  const countryQid =
    p17Rows.find((r) => r.targetQid.startsWith("Q"))?.targetQid ?? null;

  const params = classifyCivilizationPrompt({
    name: entity.name,
    type: entity.type,
    dateStart: entity.dateStart,
    dateEnd: entity.dateEnd,
    latitude: entity.latitude,
    longitude: entity.longitude,
    countryQid,
    aliases: aliasRows.map((r) => r.alias),
  });

  const estInputTokens = roughTokensFromChars(
    (params.system as string).length + params.prompt.length,
  );
  const estCost = estimateCostUsd(
    MODEL_FLASH,
    estInputTokens,
    params.maxOutputTokens,
  );
  await checkBudget(estCost);

  const t0 = Date.now();
  const result = await generateText(params);
  const output = result.output;

  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const actualCost = estimateCostUsd(MODEL_FLASH, inputTokens, outputTokens);

  await db.transaction(async (tx) => {
    if (output.tags.length > 0) {
      await tx
        .insert(entityRegions)
        .values(
          output.tags.map((tag) => ({
            entityQid: qid,
            regionKind: "civilizational",
            regionValue: tag,
          })),
        )
        .onConflictDoNothing();
    }

    await tx.insert(pipelineRuns).values({
      jobKind: "classify-civilization",
      startedAt: new Date(t0),
      finishedAt: new Date(),
      entitiesProcessed: 1,
      apiCostUsd: actualCost.toString(),
      status: "completed",
    });
  });

  return {
    qid,
    status: output.tags.length === 0 ? "no_tags" : "ok",
    tags: output.tags,
    rationale: output.rationale,
    costUsd: actualCost,
  };
}
