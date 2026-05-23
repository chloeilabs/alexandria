// Worker registration for all pg-boss queues.
// Each worker is idempotent — running the same job twice is safe.

import type { Job } from "pg-boss";

import { boss } from "../queue";
import { BudgetExceeded } from "../budget";
import { summarizeEntity } from "./summarize";

export const QUEUE_SUMMARIZE = "tier1.summarize";

interface SummarizeJobData {
  qid: string;
}

export async function registerWorkers(): Promise<void> {
  await boss.createQueue(QUEUE_SUMMARIZE);

  await boss.work<SummarizeJobData>(
    QUEUE_SUMMARIZE,
    { batchSize: 1, pollingIntervalSeconds: 2 },
    async (jobs: Job<SummarizeJobData>[]) => {
      const job = jobs[0];
      if (!job) return;
      try {
        const r = await summarizeEntity(job.data.qid);
        if (r.status === "ok") {
          console.log(
            `[summarize] ${job.data.qid} ✓  (${r.summary?.length ?? 0} chars, $${(r.costUsd ?? 0).toFixed(4)})`,
          );
        } else {
          console.log(`[summarize] ${job.data.qid} — ${r.status}`);
        }
      } catch (err) {
        if (err instanceof BudgetExceeded) {
          // Throwing here causes pg-boss to retry per the retry policy on
          // the send. The retryBackoff option (when set on send) means
          // subsequent attempts space out — typically enough for the
          // daily budget to roll over.
          console.warn(
            `[summarize] budget exceeded for ${job.data.qid}; pg-boss will retry with backoff`,
          );
        } else {
          console.error(`[summarize] ${job.data.qid} ✗`, err);
        }
        throw err;
      }
    },
  );

  console.log(`[workers] registered: ${QUEUE_SUMMARIZE}`);
}
