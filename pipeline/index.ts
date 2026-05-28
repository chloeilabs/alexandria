// Pipeline CLI entry — runs the generator loop until queue empty or
// --limit is hit. Usage:
//   pnpm pipeline run [--limit N]
//
// Operates on whichever DATABASE_URL is set. Hit Neon by sourcing
// .env.prod before invoking.

import "../lib/env";

import { generateEntity, nextPendingSeed } from "./generate";
import { BudgetExceeded } from "./budget";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0] ?? "run";
  if (cmd !== "run") {
    console.error(`unknown command: ${cmd}. usage: pnpm pipeline run [--limit N]`);
    process.exit(1);
  }

  const limitFlag = args.indexOf("--limit");
  const limit = limitFlag !== -1 ? Number(args[limitFlag + 1]) : Infinity;
  if (Number.isNaN(limit) || limit <= 0) {
    console.error("invalid --limit");
    process.exit(1);
  }

  let processed = 0;
  let verified = 0;
  let flagged = 0;
  let failed = 0;

  while (processed < limit) {
    const seed = await nextPendingSeed();
    if (!seed) {
      console.log(`[pipeline] queue empty after ${processed} seeds`);
      break;
    }

    process.stdout.write(`[pipeline] [${processed + 1}] ${seed.name} ... `);

    try {
      const result = await generateEntity(seed);
      processed++;
      if (result.status === "verified") {
        verified++;
        console.log(`verified (consensus ${result.consensusScore.toFixed(2)})`);
      } else if (result.status === "flagged") {
        flagged++;
        console.log(
          `flagged (consensus ${result.consensusScore.toFixed(2)}, ${result.highSeverity} high-sev)`,
        );
      } else if (result.status === "failed") {
        failed++;
        console.log(`failed: ${result.error}`);
      } else {
        console.log(`skipped: ${result.reason}`);
      }
    } catch (err) {
      if (err instanceof BudgetExceeded) {
        console.log("BudgetExceeded — stopping");
        console.log(err.message);
        break;
      }
      failed++;
      console.log(`error: ${(err as Error).message}`);
    }
  }

  console.log(
    `\n[pipeline] done. verified=${verified} flagged=${flagged} failed=${failed}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
