// Orchestrator: turn one seed_topics row into a published entity.
//
// Flow: budget → generate → verify → consensus → embed → insert.
// Budget is checked before every Gateway call. Each call also logs a
// generation_runs row with token counts and computed cost.

import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  entities,
  entityAliases,
  entityClaimedCitations,
  entityRelationships,
  entityTopics,
  generationRuns,
  reviewQueue,
  seedTopics,
} from "@/lib/db/schema";
import { withRetry } from "@/lib/db/retry";
import {
  estimateCostUsd,
  estimateEmbedCostUsd,
  roughTokensFromChars,
} from "@/lib/ai";
import {
  DEFAULT_GENERATOR,
  DEFAULT_VERIFIER,
  embed,
  generateStructured,
} from "@/lib/ai/gateway";
import { checkBudget } from "./budget";
import { buildGeneratePrompt, generateSchema, generateSystem } from "./prompts/generate";
import { buildVerifyPrompt, verifySchema, verifySystem } from "./prompts/verify";

export type GenerateResult =
  | { status: "verified"; entityId: string; consensusScore: number }
  | { status: "flagged"; entityId: string; consensusScore: number; highSeverity: number }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

interface SeedRow {
  id: number;
  name: string;
  hint: string | null;
  entityTypeGuess: string | null;
}

// Strip Postgres-incompatible NULL bytes (\x00) and lone surrogate halves
// from any string inside an arbitrary JSON-like value. Models occasionally
// emit `\x00` in place of accented characters (e.g. `Ren\x00 Cailli\x00` for
// `René Caillié`); Postgres text columns reject any byte sequence containing
// `\x00`. We replace null bytes with empty string rather than raising,
// because the surrounding prose is still useful and the verifier already
// flagged the issue.
function sanitizeForPostgres<T>(value: T): T {
  if (typeof value === "string") {
    return value
      .replace(/\x00/g, "")
      // Strip unpaired surrogates which also break utf-8 encoding.
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
      .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "") as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForPostgres(v)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeForPostgres(v);
    }
    return out as T;
  }
  return value;
}

function consensusScoreFrom(
  disagreements: { severity: "low" | "medium" | "high" }[],
): { score: number; highSeverity: number; mediumSeverity: number } {
  const highSeverity = disagreements.filter((d) => d.severity === "high").length;
  const mediumSeverity = disagreements.filter((d) => d.severity === "medium").length;
  const raw = 1 - (highSeverity * 0.3 + mediumSeverity * 0.1);
  return {
    score: Math.max(0, Math.min(1, raw)),
    highSeverity,
    mediumSeverity,
  };
}

async function logRun(args: {
  entityId: string | null;
  seedTopicId: number;
  jobKind: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  status: "completed" | "failed";
  error?: string;
}): Promise<void> {
  await withRetry("logRun", async () => {
    await db.insert(generationRuns).values({
      entityId: args.entityId,
      seedTopicId: args.seedTopicId,
      jobKind: args.jobKind,
      model: args.model,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      apiCostUsd: args.costUsd.toFixed(6),
      status: args.status,
      error: args.error ?? null,
      finishedAt: new Date(),
    });
  });
}

export async function generateEntity(
  seed: SeedRow,
  opts: { corrections?: string[]; targetEntityId?: string } = {},
): Promise<GenerateResult> {
  // Pre-flight budget estimate: generate + verify ~ same Flash cost,
  // embed adds a tiny Voyage charge.
  const estimateGenerate = estimateCostUsd(DEFAULT_GENERATOR, 1500, 2500);
  await checkBudget(estimateGenerate);

  // ---- Step 1: generate ---------------------------------------------
  let generated;
  try {
    generated = await generateStructured({
      schema: generateSchema,
      prompt: buildGeneratePrompt({ ...seed, corrections: opts.corrections }),
      system: generateSystem,
      model: DEFAULT_GENERATOR,
    });
  } catch (err) {
    await logRun({
      entityId: null,
      seedTopicId: seed.id,
      jobKind: "generate",
      model: DEFAULT_GENERATOR,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      status: "failed",
      error: (err as Error).message,
    });
    return { status: "failed", error: (err as Error).message };
  }

  const generateCost = estimateCostUsd(
    generated.model,
    generated.usage.promptTokens,
    generated.usage.completionTokens,
  );

  // ---- Step 2: verify ------------------------------------------------
  await checkBudget(generateCost);
  let verified;
  try {
    verified = await generateStructured({
      schema: verifySchema,
      prompt: buildVerifyPrompt(generated.object),
      system: verifySystem,
      model: DEFAULT_VERIFIER,
      temperature: 0.1,
    });
  } catch (err) {
    await logRun({
      entityId: null,
      seedTopicId: seed.id,
      jobKind: "verify",
      model: DEFAULT_VERIFIER,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      status: "failed",
      error: (err as Error).message,
    });
    return { status: "failed", error: (err as Error).message };
  }

  const verifyCost = estimateCostUsd(
    verified.model,
    verified.usage.promptTokens,
    verified.usage.completionTokens,
  );

  const consensus = consensusScoreFrom(verified.object.disagreements);
  const shouldFlag =
    consensus.highSeverity > 0 || consensus.score < 0.5;

  // ---- Step 3: embed -------------------------------------------------
  const embedText =
    `${generated.object.canonicalName}. ${generated.object.shortDescription} ${generated.object.summary}`.slice(
      0,
      8000,
    );
  await checkBudget(estimateEmbedCostUsd(roughTokensFromChars(embedText.length)));

  let embedded;
  try {
    embedded = await embed(embedText);
  } catch (err) {
    await logRun({
      entityId: null,
      seedTopicId: seed.id,
      jobKind: "embed",
      model: "voyage/voyage-4-large",
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      status: "failed",
      error: (err as Error).message,
    });
    return { status: "failed", error: (err as Error).message };
  }
  const embedCost = estimateEmbedCostUsd(embedded.tokens);

  // ---- Step 4: insert ------------------------------------------------
  const entityId = await withRetry("insertEntity", async () => {
    return await db.transaction(async (tx) => {
      const obj = sanitizeForPostgres(generated.object);
      const verifiedDisagreements = sanitizeForPostgres(
        verified.object.disagreements,
      );
      const now = new Date();
      const status = shouldFlag ? "flagged" : "published";
      const writeValues = {
        canonicalName: obj.canonicalName,
        disambiguator: obj.disambiguator,
        entityType: obj.entityType,
        status,
        shortDescription: obj.shortDescription,
        summary: obj.summary,
        narrative: obj.narrative,
        structuredFacts: obj.structuredFacts,
        keyDates: obj.keyDates,
        coords: obj.coords,
        generatorModel: generated.model,
        verifierModel: verified.model,
        consensusScore: consensus.score,
        disagreementNotes: verifiedDisagreements,
        embedding: embedded.embedding,
        publishedAt: status === "published" ? now : null,
      };

      let newId: string;
      if (opts.targetEntityId) {
        // Remediation: update the existing row in place — preserve the id
        // (so entity_relationships + featured_rotation refs stay valid) and
        // keep the original slug (so URLs don't break). Replace side rows.
        await tx
          .update(entities)
          .set({ ...writeValues, updatedAt: now })
          .where(eq(entities.id, opts.targetEntityId));
        newId = opts.targetEntityId;
        await tx.delete(entityAliases).where(eq(entityAliases.entityId, newId));
        await tx.delete(entityTopics).where(eq(entityTopics.entityId, newId));
        await tx
          .delete(entityClaimedCitations)
          .where(eq(entityClaimedCitations.entityId, newId));
        await tx
          .delete(entityRelationships)
          .where(eq(entityRelationships.sourceId, newId));
      } else {
        const [row] = await tx
          .insert(entities)
          .values({ slug: obj.slug, ...writeValues })
          .returning({ id: entities.id });
        if (!row) throw new Error("entities insert returned no row");
        newId = row.id;
      }

      if (obj.aliases.length) {
        await tx
          .insert(entityAliases)
          .values(obj.aliases.map((alias) => ({ entityId: newId, alias })))
          .onConflictDoNothing();
      }

      if (obj.topics.length) {
        await tx
          .insert(entityTopics)
          .values(obj.topics.map((topic) => ({ entityId: newId, topic })))
          .onConflictDoNothing();
      }

      if (obj.citations.length) {
        await tx.insert(entityClaimedCitations).values(
          obj.citations.map((c) => ({
            entityId: newId,
            claimExcerpt: c.claim,
            claimedSource: c.source,
            claimedUrl: c.url,
            claimedAuthor: c.author,
            claimKind: c.kind,
            verifiedBySecondModel: verified.object.verdict === "agree",
          })),
        );
      }

      // Only insert relationships if the target slug already exists.
      for (const rel of obj.relationships) {
        const targetSlug = rel.targetName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        if (!targetSlug) continue;
        const target = await tx
          .select({ id: entities.id })
          .from(entities)
          .where(eq(entities.slug, targetSlug))
          .limit(1);
        const targetRow = target[0];
        if (!targetRow) continue;
        await tx
          .insert(entityRelationships)
          .values({
            sourceId: newId,
            targetId: targetRow.id,
            predicate: rel.predicate,
          })
          .onConflictDoNothing();
      }

      if (shouldFlag) {
        await tx.insert(reviewQueue).values({
          entityId: newId,
          reason: "consensus_disagreement",
          severity: consensus.highSeverity > 0 ? 3 : 2,
          disagreementJsonb: verified.object.disagreements,
        });
      }

      // Seed-driven generation marks the seed done. Remediation
      // (targetEntityId set) has no seed row to update.
      if (!opts.targetEntityId) {
        await tx
          .update(seedTopics)
          .set({ status: "done", lastAttemptedAt: now })
          .where(eq(seedTopics.id, seed.id));
      }

      return newId;
    });
  });

  // log all three runs with the entity id attached
  await Promise.all([
    logRun({
      entityId,
      seedTopicId: seed.id,
      jobKind: "generate",
      model: generated.model,
      promptTokens: generated.usage.promptTokens,
      completionTokens: generated.usage.completionTokens,
      costUsd: generateCost,
      status: "completed",
    }),
    logRun({
      entityId,
      seedTopicId: seed.id,
      jobKind: "verify",
      model: verified.model,
      promptTokens: verified.usage.promptTokens,
      completionTokens: verified.usage.completionTokens,
      costUsd: verifyCost,
      status: "completed",
    }),
    logRun({
      entityId,
      seedTopicId: seed.id,
      jobKind: "embed",
      model: embedded.model,
      promptTokens: embedded.tokens,
      completionTokens: 0,
      costUsd: embedCost,
      status: "completed",
    }),
  ]);

  if (shouldFlag) {
    return {
      status: "flagged",
      entityId,
      consensusScore: consensus.score,
      highSeverity: consensus.highSeverity,
    };
  }
  return { status: "verified", entityId, consensusScore: consensus.score };
}

export async function nextPendingSeed(): Promise<SeedRow | null> {
  return await withRetry("nextPendingSeed", async () => {
    const rows = await db
      .select({
        id: seedTopics.id,
        name: seedTopics.name,
        hint: seedTopics.hint,
        entityTypeGuess: seedTopics.entityTypeGuess,
      })
      .from(seedTopics)
      .where(eq(seedTopics.status, "pending"))
      .orderBy(sql`${seedTopics.priority} DESC, ${seedTopics.id} ASC`)
      .limit(1);
    const first = rows[0];
    if (!first) return null;
    // claim it
    await db
      .update(seedTopics)
      .set({ status: "generating", lastAttemptedAt: new Date() })
      .where(eq(seedTopics.id, first.id));
    return first;
  });
}
