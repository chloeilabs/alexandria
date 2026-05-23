// Hard daily API spend cap.
// Workers call `checkBudget(estimatedCost)` BEFORE each Claude call.
// If today's spend + estimated would exceed DAILY_BUDGET_USD, throws
// `BudgetExceeded` and the pipeline pauses (pg-boss retries with backoff).

import "../lib/env";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";

export const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD ?? 20);

export class BudgetExceeded extends Error {
  constructor(
    public readonly spent: number,
    public readonly estimated: number,
    public readonly cap: number,
  ) {
    super(
      `Daily budget $${cap.toFixed(2)} exceeded (spent: $${spent.toFixed(4)}, would add: $${estimated.toFixed(4)})`,
    );
    this.name = "BudgetExceeded";
  }
}

export async function todaysSpendUsd(): Promise<number> {
  const rows = await db.execute<{ sum: string | null }>(sql`
    SELECT COALESCE(SUM(api_cost_usd), 0)::text AS sum
    FROM pipeline_runs
    WHERE started_at::date = CURRENT_DATE
      AND status IN ('completed', 'running')
  `);
  const r = rows[0];
  if (!r) return 0;
  return parseFloat(r.sum ?? "0");
}

/**
 * Throws BudgetExceeded if today's running total + the estimated cost of
 * the next call would breach the cap. Call this before every Claude API
 * invocation.
 */
export async function checkBudget(estimatedCost: number): Promise<void> {
  const spent = await todaysSpendUsd();
  if (spent + estimatedCost > DAILY_BUDGET_USD) {
    throw new BudgetExceeded(spent, estimatedCost, DAILY_BUDGET_USD);
  }
}
