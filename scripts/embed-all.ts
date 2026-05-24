#!/usr/bin/env tsx
/**
 * Embed every entity that doesn't yet have a vector.
 *
 * Sequential. Each call hits AI Gateway's Voyage 4 large endpoint. Honors
 * DAILY_BUDGET_USD via the budget guard inside embedEntity.
 *
 * Usage:
 *   pnpm tsx scripts/embed-all.ts                # everything missing
 *   pnpm tsx scripts/embed-all.ts --limit=50     # cap the run
 *   pnpm tsx scripts/embed-all.ts --force        # re-embed everything
 */
import "../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { embedManyEntities } from "../pipeline/workers/embed";
import { BudgetExceeded } from "../pipeline/budget";

async function main(): Promise<void> {
  let limit: number | null = null;
  let force = false;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    } else if (a === "--force") {
      force = true;
    }
  }

  const rows = await db.execute<{ qid: string }>(sql`
    SELECT qid FROM entities
    ${force ? sql`` : sql`WHERE embedding IS NULL`}
    ORDER BY inbound_link_count DESC, tier DESC, qid ASC
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `);

  const qids = Array.from(rows).map((r) => r.qid);
  console.log(
    `Embedding ${qids.length} ${force ? "entities (force re-embed)" : "entities missing vectors"} in chunks of 128…\n`,
  );

  try {
    const summary = await embedManyEntities(qids, { force });
    console.log(
      `\n${summary.embedded} embedded  ·  ${summary.alreadyDone} skipped  ·  ${summary.notFound} not found`,
    );
    console.log(
      `Total: ${summary.totalTokens} tokens, $${summary.totalCostUsd.toFixed(6)} spent`,
    );
  } catch (err) {
    if (err instanceof BudgetExceeded) {
      console.log(
        `\n✗  BUDGET EXCEEDED (${err.window} window): $${err.spent.toFixed(2)} spent; stopping`,
      );
    } else {
      console.error(err);
      process.exit(1);
    }
  }

  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
