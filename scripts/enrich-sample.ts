#!/usr/bin/env tsx
/**
 * Run the Tier 0 → Tier 1 enrichment against our seeded sample entities.
 * Useful for prompt calibration and for the demo when the bulk pipeline
 * isn't running yet.
 *
 * Requires ANTHROPIC_API_KEY in .env.local.
 *
 * Usage:
 *   pnpm tsx scripts/enrich-sample.ts
 *   pnpm tsx scripts/enrich-sample.ts Q1048 Q237
 */
import "dotenv/config";
import { summarizeEntity } from "../pipeline/workers/summarize";
import { db } from "../lib/db";

const DEFAULT_QIDS = ["Q1048", "Q237", "Q183491", "Q43421", "Q9695"];

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const qids = argv.length > 0 ? argv : DEFAULT_QIDS;

  console.log(`Enriching ${qids.length} entities to Tier 1…\n`);

  let totalCost = 0;
  for (const qid of qids) {
    process.stdout.write(`${qid}: `);
    try {
      const r = await summarizeEntity(qid);
      if (r.status === "ok") {
        totalCost += r.costUsd ?? 0;
        console.log(
          `✓ Tier 1  (${r.summary?.length ?? 0} chars, $${(r.costUsd ?? 0).toFixed(4)})`,
        );
        console.log("\n" + (r.summary ?? "") + "\n");
        console.log("---\n");
      } else {
        console.log(`— ${r.status}`);
      }
    } catch (err) {
      console.log(`✗ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`Total spend this run: $${totalCost.toFixed(4)}`);
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
