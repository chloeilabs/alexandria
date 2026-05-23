// Tier 1 → Tier 2 worker. Multi-source narration: Wikipedia + 1911
// Britannica when Wikisource has the entry. The narrate prompt asks
// the model to synthesise across the two views and flag any conflicts
// briefly rather than picking one and ignoring the other.
//
// Idempotent: skips entities already at Tier 2+ unless `force` is set.
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
import {
  fetchBritannica1911,
  type EntityHintType,
} from "../../lib/wikisource";
import { checkBudget } from "../budget";

const WIKIPEDIA_NARRATE_CHAR_BUDGET = 12_000;
const BRITANNICA_NARRATE_CHAR_BUDGET = 9_000;

export interface NarrateResult {
  qid: string;
  status: "ok" | "no_source" | "already_done" | "not_found" | "wrong_tier";
  narrative?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  /** Which source kinds fed the narrative (e.g. ["wikipedia", "britannica_1911"]). */
  sourceKinds?: string[];
}

const TYPE_HINT: Record<string, EntityHintType> = {
  person: "person",
  place: "place",
  event: "event",
  organization: "organization",
  work: "work",
  concept: "concept",
};

export interface NarrateOptions {
  /** Re-narrate even if the entity is already at Tier 2. Used for the
   *  Britannica re-run on previously single-sourced entries. */
  force?: boolean;
}

export async function narrateEntity(
  qid: string,
  opts: NarrateOptions = {},
): Promise<NarrateResult> {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.qid, qid))
    .limit(1);

  if (!entity) return { qid, status: "not_found" };
  if (!opts.force && entity.tier >= 2 && entity.narrative) {
    return { qid, status: "already_done" };
  }
  if (entity.tier < 1) return { qid, status: "wrong_tier" };

  // --- Wikipedia source ---
  // Prefer the stored row; otherwise fetch fresh and persist.
  const storedRows = await db
    .select()
    .from(sources)
    .where(eq(sources.entityQid, qid));
  const storedByKind = new Map<string, (typeof storedRows)[number]>();
  for (const r of storedRows) storedByKind.set(r.sourceKind, r);

  let wikipediaText: string | null = null;
  let wikipediaUrl = "";
  const storedWp = storedByKind.get("wikipedia");
  if (storedWp?.content) {
    wikipediaText = storedWp.content;
    wikipediaUrl = storedWp.url ?? "";
  } else {
    const article = await fetchPlaintext(entity.name);
    if (article && article.extract.length >= 400) {
      wikipediaText = article.extract;
      wikipediaUrl = article.url;
      await db
        .insert(sources)
        .values({
          entityQid: qid,
          sourceKind: "wikipedia",
          url: wikipediaUrl,
          content: wikipediaText,
          license: "CC BY-SA 4.0",
        })
        .onConflictDoNothing({
          target: [sources.entityQid, sources.sourceKind],
        });
    }
  }

  if (!wikipediaText) return { qid, status: "no_source" };

  // --- Britannica 1911 source (best-effort) ---
  let britannicaText: string | null = null;
  let britannicaUrl = "";
  const storedBr = storedByKind.get("britannica_1911");
  if (storedBr?.content) {
    britannicaText = storedBr.content;
    britannicaUrl = storedBr.url ?? "";
  } else {
    try {
      const hint = TYPE_HINT[entity.type];
      const br = await fetchBritannica1911(entity.name, hint);
      if (br) {
        britannicaText = br.text;
        britannicaUrl = br.url;
        await db
          .insert(sources)
          .values({
            entityQid: qid,
            sourceKind: "britannica_1911",
            url: britannicaUrl,
            content: britannicaText,
            license: "Public domain",
          })
          .onConflictDoNothing({
            target: [sources.entityQid, sources.sourceKind],
          });
      }
    } catch (err) {
      // Wikisource hiccup — don't fail the whole narrate; just skip
      // the second source on this run.
      console.warn(
        `[narrate] britannica fetch failed for ${qid}; falling back to Wikipedia-only`,
        err,
      );
    }
  }

  // --- Build the narrate sources list ---
  const narrateSources: NarrateSource[] = [
    {
      kind: "wikipedia",
      url: wikipediaUrl,
      content: wikipediaText.slice(0, WIKIPEDIA_NARRATE_CHAR_BUDGET),
    },
  ];
  if (britannicaText) {
    narrateSources.push({
      kind: "britannica_1911",
      url: britannicaUrl,
      content: britannicaText.slice(0, BRITANNICA_NARRATE_CHAR_BUDGET),
    });
  }

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

  const sourceAttribution = {
    sources: narrateSources.map((s) => ({
      kind: s.kind,
      url: s.url ?? "",
      license:
        s.kind === "wikipedia"
          ? "CC BY-SA 4.0"
          : s.kind === "britannica_1911"
            ? "Public domain"
            : "Unknown",
    })),
  };

  await db.transaction(async (tx) => {
    await tx
      .update(entities)
      .set({
        narrative,
        sourceAttribution,
        tier: 2,
        tierUpgradedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(entities.qid, qid));

    await tx.insert(pipelineRuns).values({
      jobKind: britannicaText ? "narrate-multi" : "narrate",
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
    sourceKinds: narrateSources.map((s) => s.kind),
  };
}
