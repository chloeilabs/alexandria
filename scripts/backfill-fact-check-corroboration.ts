#!/usr/bin/env tsx
/**
 * Retroactively add OpenAlex corroboration to every finding in the
 * latest-per-entity flagged fact-check review. The OpenAlex
 * integration shipped in PR #8 only enriches NEW fact-check runs;
 * existing reviews ride unmodified. This walks them.
 *
 * Idempotent per-finding (skips ones that already have `corroboration`).
 * Latest-per-entity only — older reviews are superseded by the schema
 * design (entity pages read the most recent), so backfilling history
 * burns OpenAlex calls for content nobody renders.
 *
 * Free at our scale: ~2,500 findings × 1 OpenAlex call each, well under
 * the $1/day / 100K-calls-per-day free tier with the API key set.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-fact-check-corroboration.ts             # dry-run
 *   pnpm tsx scripts/backfill-fact-check-corroboration.ts --apply     # write
 *   pnpm tsx scripts/backfill-fact-check-corroboration.ts --limit=5   # cap
 */
import "../lib/env";
import { eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { factCheckReviews } from "../lib/db/schema";
import { corroborateClaim, type ClaimCorroboration } from "../lib/openalex";

interface Finding {
  claim: string;
  reason: "missing" | "contradicts" | "uncertain" | string;
  source_excerpt?: string;
  corroboration?: ClaimCorroboration;
}

interface Args {
  apply: boolean;
  limit: number | null;
  /** Re-corroborate findings whose existing corroboration is empty
   *  (signal=weak, totalMatches=0, topWorks=[]) — these are almost
   *  always rate-limit residue from an earlier run, not real misses. */
  retryEmpty: boolean;
}

function parseArgs(): Args {
  const out: Args = { apply: false, limit: null, retryEmpty: false };
  for (const a of process.argv.slice(2)) {
    if (a === "--apply") out.apply = true;
    else if (a === "--retry-empty") out.retryEmpty = true;
    else if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) out.limit = n;
    }
  }
  return out;
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main(): Promise<void> {
  const args = parseArgs();

  // DISTINCT ON (entity_qid) ordered by created_at DESC gives the most
  // recent flagged review per entity — matches what the entity page reads.
  const rows = await db.execute<{
    id: number;
    entity_qid: string;
    entity_name: string;
    flagged_claims: Finding[] | null;
  }>(sql`
    SELECT DISTINCT ON (r.entity_qid)
      r.id,
      r.entity_qid,
      e.name AS entity_name,
      r.flagged_claims
    FROM fact_check_reviews r
    JOIN entities e ON e.qid = r.entity_qid
    WHERE r.status = 'flagged'
    ORDER BY r.entity_qid, r.created_at DESC
    ${args.limit ? sql`LIMIT ${args.limit}` : sql``}
  `);
  const reviews = Array.from(rows);
  console.log(
    `Backfilling corroboration on ${reviews.length} latest-per-entity flagged reviews ` +
      `(${args.apply ? "APPLY: will write" : "dry-run: no writes"})\n`,
  );

  let reviewsTouched = 0;
  let reviewsSkipped = 0;
  let findingsCorroborated = 0;
  let findingsAlreadyHadIt = 0;
  let openalexErrors = 0;
  const signalCounts: Record<string, number> = { strong: 0, partial: 0, weak: 0 };

  for (const r of reviews) {
    const findings = (r.flagged_claims ?? []) as Finding[];
    if (findings.length === 0) {
      reviewsSkipped += 1;
      continue;
    }

    let touchedThis = false;
    const updated: Finding[] = [];
    for (const f of findings) {
      const isEmptyCorroboration =
        f.corroboration != null &&
        f.corroboration.totalMatches === 0 &&
        (f.corroboration.topWorks?.length ?? 0) === 0;
      const shouldSkip =
        f.corroboration && !(args.retryEmpty && isEmptyCorroboration);
      if (shouldSkip) {
        findingsAlreadyHadIt += 1;
        updated.push(f);
        continue;
      }
      try {
        const corroboration = await corroborateClaim(r.entity_name, f.claim, {
          limit: 3,
        });
        signalCounts[corroboration.signal] =
          (signalCounts[corroboration.signal] ?? 0) + 1;
        updated.push({ ...f, corroboration });
        findingsCorroborated += 1;
        touchedThis = true;
      } catch (err) {
        openalexErrors += 1;
        console.warn(
          `  ${r.entity_qid} #${r.id}: openalex error on "${f.claim.slice(0, 60)}…" — ${err instanceof Error ? err.message : String(err)}`,
        );
        updated.push(f);
      }
      // 10 req/sec authenticated → 100 ms minimum; 150 leaves margin
      // for the API's internal batching of our search call.
      await sleep(150);
    }

    if (!touchedThis) {
      reviewsSkipped += 1;
      continue;
    }

    if (args.apply) {
      await db
        .update(factCheckReviews)
        .set({ flaggedClaims: updated })
        .where(eq(factCheckReviews.id, r.id));
    }
    reviewsTouched += 1;
    const signalBreakdown = updated
      .map((u) => u.corroboration?.signal?.[0] ?? "·")
      .join("");
    console.log(
      `  ${r.entity_qid.padEnd(10)} ${r.entity_name.slice(0, 24).padEnd(24)} ` +
        `#${r.id} +${updated.filter((u, i) => u.corroboration && !findings[i]?.corroboration).length} corrob  [${signalBreakdown}]`,
    );
  }

  console.log(
    `\n${reviewsTouched} reviews enriched · ${reviewsSkipped} skipped (no new findings to corroborate) · ${openalexErrors} OpenAlex errors`,
  );
  console.log(
    `${findingsCorroborated} findings newly corroborated · ${findingsAlreadyHadIt} already had it`,
  );
  console.log(
    `Signals: strong=${signalCounts.strong} partial=${signalCounts.partial} weak=${signalCounts.weak}`,
  );
  if (!args.apply && reviewsTouched > 0) {
    console.log("\nRe-run with --apply to write.");
  }

  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
