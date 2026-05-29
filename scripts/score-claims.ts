// Enrichment pass: decompose each published entity's narrative into atomic
// claims and score every claim by semantic entropy. Writes entity_claims rows
// and updates entities.claim_factuality_score / claims_scored_at.
//
// Usage:
//   pnpm tsx scripts/score-claims.ts [--limit N] [--slug some-slug] [--rescore]
//
// Without --rescore, only entities that have never been scored
// (claims_scored_at IS NULL) are processed. With --slug, scores one entity.

import "../lib/env";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { entities, entityClaims, generationRuns } from "@/lib/db/schema";
import { withRetry } from "@/lib/db/retry";
import { estimateCostUsd } from "@/lib/ai";
import { scoreEntityClaims } from "@/lib/claims/score";
import { checkBudget, BudgetExceeded } from "../pipeline/budget";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(name);

async function main(): Promise<void> {
  const limit = Number(arg("--limit") ?? 10);
  const slug = arg("--slug");
  const rescore = hasFlag("--rescore");

  const rows = await withRetry("score:select", () =>
    db
      .select({
        id: entities.id,
        slug: entities.slug,
        name: entities.canonicalName,
        narrative: entities.narrative,
      })
      .from(entities)
      .where(
        slug
          ? eq(entities.slug, slug)
          : and(
              eq(entities.status, "published"),
              rescore ? undefined : isNull(entities.claimsScoredAt),
            ),
      )
      .orderBy(asc(entities.createdAt))
      .limit(slug ? 1 : limit),
  );

  if (rows.length === 0) {
    console.log("nothing to score (all caught up, or slug not found)");
    return;
  }

  console.log(`scoring ${rows.length} entit${rows.length === 1 ? "y" : "ies"}…\n`);

  for (const [i, e] of rows.entries()) {
    // Conservative pre-flight estimate so the budget cap can stop us cleanly.
    await checkBudget(0.15);

    process.stdout.write(`[${i + 1}/${rows.length}] ${e.name} … `);
    try {
      const result = await scoreEntityClaims({
        canonicalName: e.name,
        narrative: e.narrative,
      });

      // Cost + token totals from accumulated usage (for the budget ledger).
      let costUsd = 0;
      let promptTokens = 0;
      let completionTokens = 0;
      for (const [model, u] of Object.entries(result.usageByModel)) {
        costUsd += estimateCostUsd(model, u.promptTokens, u.completionTokens);
        promptTokens += u.promptTokens;
        completionTokens += u.completionTokens;
      }

      await withRetry("score:write", () =>
        db.transaction(async (tx) => {
          await tx.delete(entityClaims).where(eq(entityClaims.entityId, e.id));
          if (result.claims.length > 0) {
            await tx.insert(entityClaims).values(
              result.claims.map((c) => ({
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
              claimFactualityScore: result.factualityScore,
              claimsScoredAt: new Date(),
            })
            .where(eq(entities.id, e.id));
          // Log spend so the budget cap sees claim-scoring cost.
          await tx.insert(generationRuns).values({
            entityId: e.id,
            jobKind: "score-claims",
            model: "claim-scoring",
            promptTokens,
            completionTokens,
            apiCostUsd: costUsd.toFixed(6),
            status: "completed",
            finishedAt: new Date(),
          });
        }),
      );

      const contradicted = result.claims.filter(
        (c) => c.verdict === "contradicted",
      ).length;
      console.log(
        `${(result.factualityScore * 100).toFixed(0)}% factual ` +
          `(${result.claims.length} claims, ${contradicted} contradicted) ` +
          `· $${costUsd.toFixed(4)}`,
      );
    } catch (err) {
      if (err instanceof BudgetExceeded) {
        console.log(`\nBudgetExceeded — stopping. ${err.message}`);
        break;
      }
      console.log(`error: ${(err as Error).message}`);
    }
  }

  // Tiny summary.
  const [agg] = await withRetry("score:summary", () =>
    db
      .select({
        scored: sql<number>`count(*) FILTER (WHERE ${entities.claimsScoredAt} IS NOT NULL)`,
        avg: sql<number>`coalesce(avg(${entities.claimFactualityScore}) FILTER (WHERE ${entities.claimsScoredAt} IS NOT NULL), 0)`,
      })
      .from(entities),
  );
  console.log(
    `\ncorpus: ${agg?.scored ?? 0} entities scored, avg claim-factuality ${(
      Number(agg?.avg ?? 0) * 100
    ).toFixed(0)}%`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
