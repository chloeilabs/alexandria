#!/usr/bin/env tsx
/**
 * Long-running worker process. Starts pg-boss against the project DB and
 * registers all 5 queues (summarize, narrate, tag, embed, fact-check)
 * with the parallelism settings from pipeline/workers/index.ts.
 *
 * Run:
 *   pnpm tsx scripts/run-workers.ts
 *
 * Keep the process alive — it polls pg-boss and drains jobs. SIGINT/
 * SIGTERM stops the queue gracefully (waits up to 60s for in-flight
 * jobs to finish; see pipeline/queue.ts:stopQueue).
 *
 * Operationally: locally, you'd `pnpm tsx scripts/run-workers.ts &` in a
 * dedicated terminal while a separate process runs the priority-queue
 * enqueuers (Phase 2 scripts). The two communicate exclusively through
 * pg-boss tables, so they can live on different machines.
 */
import "../lib/env";
import { boss, startQueue, stopQueue } from "../pipeline/queue";
import { registerWorkers } from "../pipeline/workers";

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[run-workers] ${signal} received — draining pg-boss queues…`);
  try {
    await stopQueue();
    console.log("[run-workers] queues drained, exiting cleanly");
  } catch (err) {
    console.error("[run-workers] error during shutdown", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

async function main(): Promise<void> {
  console.log("[run-workers] starting pg-boss…");
  await startQueue();
  await registerWorkers();
  console.log(
    "[run-workers] workers active. Enqueue with boss.send(<queue>, { qid }).",
  );

  // Periodic queue size report so the operator sees throughput.
  setInterval(async () => {
    try {
      const stats = await Promise.all(
        [
          "tier1.summarize",
          "tier2.narrate",
          "tag",
          "embed",
          "fact-check",
        ].map(async (name) => {
          const s = await boss.getQueueStats(name);
          return { name, queued: s.queuedCount, active: s.activeCount };
        }),
      );
      const nonEmpty = stats.filter((s) => s.queued + s.active > 0);
      if (nonEmpty.length > 0) {
        const parts = nonEmpty
          .map((s) => `${s.name}=${s.queued}q/${s.active}a`)
          .join(" ");
        console.log(`[run-workers] ${parts}`);
      }
    } catch {
      // Transient — pg-boss may be mid-restart; ignore one tick.
    }
  }, 30_000);
}

main().catch((err) => {
  console.error("[run-workers] fatal", err);
  process.exit(1);
});
