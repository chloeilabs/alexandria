// Public quality / transparency dashboard aggregates.

import { desc, eq, sql } from "drizzle-orm";

import { db } from "..";
import {
  entities,
  entityClaims,
  entityTopics,
  generationRuns,
  reviewQueue,
} from "../schema";
import { withRetry } from "../retry";

export interface QualitySummary {
  totalPublished: number;
  totalFlagged: number;
  totalReviewQueueOpen: number;
  avgConsensusScore: number;
  // Per-claim semantic-entropy enrichment (null-safe; 0 until any scored).
  entitiesScored: number;
  avgClaimFactuality: number;
  claimVerdicts: { corroborated: number; uncertain: number; contradicted: number };
  consensusByType: Array<{ entityType: string; avgConsensus: number; count: number }>;
  modelCoverage: Array<{ model: string; count: number }>;
  topTopics: Array<{ topic: string; count: number }>;
  latestRuns: Array<{
    id: number;
    model: string;
    jobKind: string;
    apiCostUsd: string;
    status: string;
    finishedAt: Date | null;
  }>;
}

export async function getQualitySummary(): Promise<QualitySummary> {
  return await withRetry("getQualitySummary", async () => {
    const [
      totalsRow,
      flaggedRow,
      openReviewRow,
      claimStatsRow,
      verdictRows,
      consensusByType,
      modelCoverage,
      topTopics,
      latestRuns,
    ] = await Promise.all([
      db
        .select({
          published: sql<number>`count(*) FILTER (WHERE status = 'published')::int`,
          avgConsensus: sql<number>`COALESCE(AVG(consensus_score) FILTER (WHERE status = 'published'), 0)::float`,
        })
        .from(entities),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(entities)
        .where(eq(entities.status, "flagged")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviewQueue)
        .where(sql`${reviewQueue.resolvedAt} IS NULL`),
      db
        .select({
          scored: sql<number>`count(*) FILTER (WHERE claims_scored_at IS NOT NULL)::int`,
          avgFactuality: sql<number>`COALESCE(AVG(claim_factuality_score) FILTER (WHERE claims_scored_at IS NOT NULL), 0)::float`,
        })
        .from(entities),
      db
        .select({
          verdict: entityClaims.verdict,
          count: sql<number>`count(*)::int`,
        })
        .from(entityClaims)
        .groupBy(entityClaims.verdict),
      db
        .select({
          entityType: entities.entityType,
          avgConsensus: sql<number>`AVG(consensus_score)::float`,
          count: sql<number>`count(*)::int`,
        })
        .from(entities)
        .where(eq(entities.status, "published"))
        .groupBy(entities.entityType)
        .orderBy(desc(sql`count(*)`)),
      db
        .select({
          model: entities.generatorModel,
          count: sql<number>`count(*)::int`,
        })
        .from(entities)
        .groupBy(entities.generatorModel)
        .orderBy(desc(sql`count(*)`)),
      db
        .select({
          topic: entityTopics.topic,
          count: sql<number>`count(*)::int`,
        })
        .from(entityTopics)
        .innerJoin(entities, eq(entities.id, entityTopics.entityId))
        .where(eq(entities.status, "published"))
        .groupBy(entityTopics.topic)
        .orderBy(desc(sql`count(*)`))
        .limit(20),
      db
        .select({
          id: generationRuns.id,
          model: generationRuns.model,
          jobKind: generationRuns.jobKind,
          apiCostUsd: generationRuns.apiCostUsd,
          status: generationRuns.status,
          finishedAt: generationRuns.finishedAt,
        })
        .from(generationRuns)
        .orderBy(desc(generationRuns.id))
        .limit(10),
    ]);

    const totals = totalsRow[0] ?? { published: 0, avgConsensus: 0 };
    const claimStats = claimStatsRow[0] ?? { scored: 0, avgFactuality: 0 };
    const verdicts = { corroborated: 0, uncertain: 0, contradicted: 0 };
    for (const r of verdictRows) {
      if (r.verdict in verdicts) {
        verdicts[r.verdict as keyof typeof verdicts] = r.count;
      }
    }

    return {
      totalPublished: totals.published,
      totalFlagged: flaggedRow[0]?.count ?? 0,
      totalReviewQueueOpen: openReviewRow[0]?.count ?? 0,
      avgConsensusScore: totals.avgConsensus,
      entitiesScored: claimStats.scored,
      avgClaimFactuality: claimStats.avgFactuality,
      claimVerdicts: verdicts,
      consensusByType: consensusByType.map((r) => ({
        entityType: r.entityType,
        avgConsensus: r.avgConsensus,
        count: r.count,
      })),
      modelCoverage,
      topTopics,
      latestRuns,
    };
  });
}
