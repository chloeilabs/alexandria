// Worker registration for all pg-boss queues.
// Each worker is idempotent — running the same job twice is safe.
//
// Concurrency uses pg-boss `localConcurrency` (workers spawned per queue
// per node) with `batchSize: 1` so each handler still sees one job at a
// time — keeps logging + per-job budget accounting simple while letting
// N entities process in parallel under the hourly burn cap.

import type { Job, WorkOptions } from "pg-boss";

import { boss } from "../queue";
import { BudgetExceeded } from "../budget";
import { summarizeEntity } from "./summarize";
import { narrateEntity } from "./narrate";
import { classifyEntity } from "./tag";
import { embedEntity } from "./embed";
import { factCheckEntity } from "./fact-check";

export const QUEUE_SUMMARIZE = "tier1.summarize";
export const QUEUE_NARRATE = "tier2.narrate";
export const QUEUE_TAG = "tag";
export const QUEUE_EMBED = "embed";
export const QUEUE_FACT_CHECK = "fact-check";

interface QidJobData {
  qid: string;
}

interface NarrateJobData extends QidJobData {
  force?: boolean;
}

/**
 * Wrap a per-entity worker function with the standard log + BudgetExceeded
 * handling. The handler returns void; pg-boss treats a thrown error as a
 * retry signal (BudgetExceeded works the same way — the retry backoff on
 * the send buys time for the daily/hourly cap to roll forward).
 */
function makeHandler<T extends QidJobData, R extends { status: string; costUsd?: number }>(
  queueName: string,
  run: (data: T) => Promise<R>,
  format: (qid: string, r: R) => string,
) {
  return async (jobs: Job<T>[]): Promise<void> => {
    const job = jobs[0];
    if (!job) return;
    try {
      const r = await run(job.data);
      console.log(`[${queueName}] ${job.data.qid} ${format(job.data.qid, r)}`);
    } catch (err) {
      if (err instanceof BudgetExceeded) {
        console.warn(
          `[${queueName}] budget exceeded (${err.window}) for ${job.data.qid}; pg-boss will retry with backoff`,
        );
      } else {
        console.error(`[${queueName}] ${job.data.qid} ✗`, err);
      }
      throw err;
    }
  };
}

const FAST_OPTS: WorkOptions = {
  batchSize: 1,
  localConcurrency: 8,
  pollingIntervalSeconds: 2,
};

const SLOW_OPTS: WorkOptions = {
  batchSize: 1,
  localConcurrency: 4,
  pollingIntervalSeconds: 2,
};

export async function registerWorkers(): Promise<void> {
  await Promise.all([
    boss.createQueue(QUEUE_SUMMARIZE),
    boss.createQueue(QUEUE_NARRATE),
    boss.createQueue(QUEUE_TAG),
    boss.createQueue(QUEUE_EMBED),
    boss.createQueue(QUEUE_FACT_CHECK),
  ]);

  await boss.work<QidJobData>(
    QUEUE_SUMMARIZE,
    FAST_OPTS,
    makeHandler(QUEUE_SUMMARIZE, ({ qid }) => summarizeEntity(qid), (_, r) =>
      r.status === "ok"
        ? `✓ ($${(r.costUsd ?? 0).toFixed(4)})`
        : `— ${r.status}`,
    ),
  );

  await boss.work<NarrateJobData>(
    QUEUE_NARRATE,
    SLOW_OPTS,
    makeHandler(
      QUEUE_NARRATE,
      ({ qid, force }) => narrateEntity(qid, { force }),
      (_, r) =>
        r.status === "ok"
          ? `✓ ($${(r.costUsd ?? 0).toFixed(4)})`
          : `— ${r.status}`,
    ),
  );

  await boss.work<QidJobData>(
    QUEUE_TAG,
    FAST_OPTS,
    makeHandler(QUEUE_TAG, ({ qid }) => classifyEntity(qid), (_, r) => {
      const tags = (r as { tags?: string[] }).tags?.join(",") ?? "";
      return r.status === "ok"
        ? `✓ [${tags}] ($${(r.costUsd ?? 0).toFixed(4)})`
        : `— ${r.status}`;
    }),
  );

  await boss.work<QidJobData>(
    QUEUE_EMBED,
    FAST_OPTS,
    makeHandler(QUEUE_EMBED, ({ qid }) => embedEntity(qid), (_, r) =>
      r.status === "ok"
        ? `✓ ($${(r.costUsd ?? 0).toFixed(6)})`
        : `— ${r.status}`,
    ),
  );

  await boss.work<QidJobData>(
    QUEUE_FACT_CHECK,
    SLOW_OPTS,
    makeHandler(
      QUEUE_FACT_CHECK,
      ({ qid }) => factCheckEntity(qid),
      (_, r) =>
        r.status === "clean" || r.status === "flagged"
          ? `${r.status === "clean" ? "✓" : "⚠"} ($${(r.costUsd ?? 0).toFixed(4)})`
          : `— ${r.status}`,
    ),
  );

  console.log(
    `[workers] registered: ${[
      QUEUE_SUMMARIZE,
      QUEUE_NARRATE,
      QUEUE_TAG,
      QUEUE_EMBED,
      QUEUE_FACT_CHECK,
    ].join(", ")}`,
  );
}
