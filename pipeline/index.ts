#!/usr/bin/env tsx
/**
 * Main pipeline entry. Boots pg-boss, registers all workers, and runs an
 * always-on scheduler that finds Tier 0 entities and enqueues them for
 * tier upgrade.
 *
 * Run as: `pnpm pipeline`
 * Stop:   Ctrl+C (graceful — waits for in-flight jobs to finish)
 */
import "../lib/env";
import { eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { entities } from "../lib/db/schema";
import { boss, startQueue, stopQueue } from "./queue";
import { QUEUE_SUMMARIZE, registerWorkers } from "./workers";

const POLL_INTERVAL_MS = 60_000;
const BATCH_PER_POLL = 50;

async function enqueueTier0(): Promise<number> {
  // Priority order: traffic > graph centrality > recency.
  // Traffic doesn't exist yet; for now we use inbound_link_count.
  const tier0 = await db
    .select({ qid: entities.qid })
    .from(entities)
    .where(eq(entities.tier, 0))
    .orderBy(sql`${entities.inboundLinkCount} DESC, ${entities.qid} ASC`)
    .limit(BATCH_PER_POLL);

  for (const e of tier0) {
    // singletonKey ensures we don't double-enqueue the same QID if the
    // previous attempt is still in-flight or scheduled.
    await boss.send(
      QUEUE_SUMMARIZE,
      { qid: e.qid },
      {
        singletonKey: e.qid,
        retryLimit: 5,
        retryDelay: 300, // 5 min between retries
        retryBackoff: true,
      },
    );
  }

  return tier0.length;
}

async function main(): Promise<void> {
  console.log("Booting Alexandria pipeline…\n");
  await startQueue();
  await registerWorkers();

  const initial = await enqueueTier0();
  console.log(`[scheduler] initial: enqueued ${initial} Tier 0 entities\n`);

  const interval = setInterval(() => {
    enqueueTier0()
      .then((n) => {
        if (n > 0) console.log(`[scheduler] enqueued ${n} Tier 0 entities`);
      })
      .catch((err) => console.error("[scheduler]", err));
  }, POLL_INTERVAL_MS);

  const shutdown = async (signal: NodeJS.Signals) => {
    clearInterval(interval);
    console.log(`\n${signal} — shutting down pipeline gracefully…`);
    try {
      await stopQueue();
      await db.$client.end();
    } catch (err) {
      console.error("Error during shutdown:", err);
    }
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  console.log("Pipeline running. Press Ctrl+C to stop.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
