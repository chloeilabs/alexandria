// Thin wrapper around pipeline/index.ts so `pnpm pipeline:generate
// --limit N` reads naturally even though the orchestrator lives in
// `pipeline/`.
//
// Usage:
//   pnpm tsx scripts/generate-batch.ts [--limit N]

import "../lib/env";
import { generateEntity, nextPendingSeed } from "../pipeline/generate";
import { BudgetExceeded } from "../pipeline/budget";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limitFlag = args.indexOf("--limit");
  const limit = limitFlag !== -1 ? Number(args[limitFlag + 1]) : 25;
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error("invalid --limit");
    process.exit(1);
  }

  let processed = 0;
  while (processed < limit) {
    const seed = await nextPendingSeed();
    if (!seed) {
      console.log(`queue empty after ${processed} entries`);
      break;
    }
    process.stdout.write(`[${processed + 1}/${limit}] ${seed.name} ... `);
    try {
      const result = await generateEntity(seed);
      processed++;
      if (result.status === "verified") {
        console.log(`verified (${result.consensusScore.toFixed(2)})`);
      } else if (result.status === "flagged") {
        console.log(
          `flagged (${result.consensusScore.toFixed(2)}, ${result.highSeverity} high-sev)`,
        );
      } else if (result.status === "failed") {
        console.log(`failed: ${result.error}`);
      } else {
        console.log(`skipped: ${result.reason}`);
      }
    } catch (err) {
      if (err instanceof BudgetExceeded) {
        console.log(`BudgetExceeded — stopping. ${err.message}`);
        break;
      }
      console.log(`error: ${(err as Error).message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
