// Remediation pass: regenerate the weak tail of the corpus in place,
// feeding each entity's previously-failed claims back as "get this right"
// corrections, then re-score to confirm the factuality actually rose.
//
// Closes the quality loop: generate → score → remediate worst → re-score.
//
// Usage:
//   pnpm tsx scripts/remediate.ts [--threshold 0.8] [--limit 50] [--slug X] [--dry]
//
// Regeneration is in place (preserves entity id, slug, relationships).
// Do NOT run concurrently with a score-claims backfill — both write
// entity_claims.

import "../lib/env";
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { entities, entityClaims, generationRuns } from "@/lib/db/schema";
import { withRetry } from "@/lib/db/retry";
import { captureEntity, restoreEntity } from "@/lib/db/entity-snapshot";
import { estimateCostUsd } from "@/lib/ai";
import { generateEntity } from "../pipeline/generate";
import { scoreEntityClaims } from "@/lib/claims/score";
import { checkBudget, BudgetExceeded } from "../pipeline/budget";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(name);

// `type` (not `interface`) so it satisfies db.execute's Record<string,unknown>
// generic constraint — a named interface doesn't get an implicit index sig.
type WeakRow = {
  id: string;
  slug: string;
  canonical_name: string;
  entity_type: string;
  short_description: string;
  claim_factuality_score: number;
  problem_claims: string[] | null;
};

async function main(): Promise<void> {
  const threshold = Number(arg("--threshold") ?? 0.8);
  const limit = Number(arg("--limit") ?? 50);
  const slug = arg("--slug");
  const dry = hasFlag("--dry");

  // Weakest first, each row carrying its non-corroborated claims as the
  // corrections to feed back into regeneration.
  const filter = slug
    ? sql`AND e.slug = ${slug}`
    : sql`AND e.claim_factuality_score < ${threshold}`;
  const weakResult = await withRetry("remediate:weak", () =>
    db.execute<WeakRow>(sql`
      SELECT e.id, e.slug, e.canonical_name, e.entity_type,
             e.short_description, e.claim_factuality_score,
             array_remove(
               array_agg(c.claim) FILTER (WHERE c.verdict <> 'corroborated'),
               NULL
             ) AS problem_claims
      FROM entities e
      LEFT JOIN entity_claims c ON c.entity_id = e.id
      WHERE e.status IN ('published', 'flagged')
        AND e.claims_scored_at IS NOT NULL
        ${filter}
      GROUP BY e.id
      ORDER BY e.claim_factuality_score ASC
      LIMIT ${limit}
    `),
  );
  const weak = Array.from(weakResult) as WeakRow[];

  if (weak.length === 0) {
    console.log("nothing to remediate (no entities below threshold)");
    return;
  }

  console.log(
    `${dry ? "[dry] " : ""}remediating ${weak.length} entit${weak.length === 1 ? "y" : "ies"} (threshold ${threshold})\n`,
  );

  for (const [i, e] of weak.entries()) {
    const corrections = e.problem_claims ?? [];
    const before = Number(e.claim_factuality_score);
    process.stdout.write(
      `[${i + 1}/${weak.length}] ${e.canonical_name} (${(before * 100).toFixed(0)}%, ${corrections.length} issues) … `,
    );

    if (dry) {
      console.log("would regenerate");
      continue;
    }

    try {
      await checkBudget(0.2);

      // 0. capture full state so a worse regeneration can be rolled back —
      //    keep-if-better makes remediation a monotonic ratchet.
      const snapshot = await captureEntity(e.id);

      // 1. regenerate in place with the failed claims as corrections
      const res = await generateEntity(
        {
          id: 0,
          name: e.canonical_name,
          hint: e.short_description,
          entityTypeGuess: e.entity_type,
        },
        { corrections, targetEntityId: e.id },
      );
      if (res.status === "failed") {
        console.log(`regen failed: ${res.error}`);
        continue;
      }

      // 2. re-score the regenerated entity
      const [fresh] = await withRetry("remediate:refetch", () =>
        db
          .select({
            canonicalName: entities.canonicalName,
            narrative: entities.narrative,
            consensusScore: entities.consensusScore,
          })
          .from(entities)
          .where(eq(entities.id, e.id))
          .limit(1),
      );
      if (!fresh) {
        console.log("regenerated but vanished?");
        continue;
      }

      const scored = await scoreEntityClaims(fresh);
      let costUsd = 0;
      let promptTokens = 0;
      let completionTokens = 0;
      for (const [model, u] of Object.entries(scored.usageByModel)) {
        costUsd += estimateCostUsd(model, u.promptTokens, u.completionTokens);
        promptTokens += u.promptTokens;
        completionTokens += u.completionTokens;
      }

      const after = scored.factualityScore;
      // Guard BOTH signals. Semantic-entropy (claim factuality) measures the
      // generator's self-consistency; cross-family consensus catches errors
      // the generator is confidently wrong about. Keep only if neither drops
      // — otherwise remediation could trade correctness for self-consistency
      // (observed: The Analects 0.75 claim-factual but consensus 0.20).
      const oldConsensus = snapshot.entity.consensusScore;
      const newConsensus = fresh.consensusScore;
      const keep = after >= before && newConsensus >= oldConsensus;

      if (keep) {
        // Keep: the regeneration is at least as good on both signals.
        await withRetry("remediate:write-score", () =>
          db.transaction(async (tx) => {
            await tx
              .delete(entityClaims)
              .where(eq(entityClaims.entityId, e.id));
            if (scored.claims.length > 0) {
              await tx.insert(entityClaims).values(
                scored.claims.map((c) => ({
                  entityId: e.id,
                  claim: c.claim,
                  question: c.question,
                  nSamples: c.nSamples,
                  distinctAnswers: c.distinctAnswers,
                  entropy: c.entropy,
                  verdict: c.verdict,
                  majorityAnswer: c.majorityAnswer,
                  agreesWithClaim: c.agreesWithClaim,
                })),
              );
            }
            await tx
              .update(entities)
              .set({
                claimFactualityScore: scored.factualityScore,
                claimsScoredAt: new Date(),
              })
              .where(eq(entities.id, e.id));
            await tx.insert(generationRuns).values({
              entityId: e.id,
              jobKind: "remediate-score",
              model: "claim-scoring",
              promptTokens,
              completionTokens,
              apiCostUsd: costUsd.toFixed(6),
              status: "completed",
              finishedAt: new Date(),
            });
          }),
        );
        const delta = after - before;
        const arrow = delta > 0 ? "↑" : "→";
        console.log(
          `${(after * 100).toFixed(0)}% ${arrow} (${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(0)}pts)`,
        );
      } else {
        // Worse — roll back to the captured original, fully. Still log the
        // (spent) generation cost so the budget ledger stays accurate.
        await restoreEntity(snapshot);
        await withRetry("remediate:log-rollback", () =>
          db.insert(generationRuns).values({
            entityId: e.id,
            jobKind: "remediate-rollback",
            model: "claim-scoring",
            promptTokens,
            completionTokens,
            apiCostUsd: costUsd.toFixed(6),
            status: "completed",
            finishedAt: new Date(),
          }),
        );
        const reason =
          after < before
            ? `factuality ${(after * 100).toFixed(0)}% < ${(before * 100).toFixed(0)}%`
            : `consensus ${newConsensus.toFixed(2)} < ${oldConsensus.toFixed(2)}`;
        console.log(`rolled back (${reason}), kept original`);
      }
    } catch (err) {
      if (err instanceof BudgetExceeded) {
        console.log(`\nBudgetExceeded — stopping. ${err.message}`);
        break;
      }
      console.log(`error: ${(err as Error).message}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
