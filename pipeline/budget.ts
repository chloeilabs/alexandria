// Three nested budget caps: monthly (the hard ceiling for personal/org
// spend), daily (smoother), hourly (parallel-worker smoother).
// Workers call `checkBudget(estimatedCost)` BEFORE each Gateway call;
// it throws `BudgetExceeded` if any window would be breached. pg-boss
// retries with backoff, which is usually enough for the window to clear.
//
// MONTHLY_BUDGET_USD is the master cap — the dollar amount you've actually
// committed to spending. Daily and hourly default to derivative values
// (monthly/30 and daily/10) so the curve stays smooth, but each is
// independently override-able via env.

import "../lib/env";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";

export const MONTHLY_BUDGET_USD = Number(
  process.env.MONTHLY_BUDGET_USD ?? 600,
);
export const DAILY_BUDGET_USD = Number(
  process.env.DAILY_BUDGET_USD ?? MONTHLY_BUDGET_USD / 30,
);
export const BURN_PER_HOUR_USD = Number(
  process.env.BURN_PER_HOUR_USD ?? DAILY_BUDGET_USD / 10,
);

export type BudgetWindow = "monthly" | "daily" | "hourly";

export class BudgetExceeded extends Error {
  constructor(
    public readonly spent: number,
    public readonly estimated: number,
    public readonly cap: number,
    public readonly window: BudgetWindow = "daily",
  ) {
    const label =
      window === "monthly" ? "Monthly" : window === "daily" ? "Daily" : "Hourly";
    super(
      `${label} budget $${cap.toFixed(2)} exceeded (spent: $${spent.toFixed(4)}, would add: $${estimated.toFixed(4)})`,
    );
    this.name = "BudgetExceeded";
  }
}

export async function monthlySpendUsd(): Promise<number> {
  const rows = await db.execute<{ sum: string | null }>(sql`
    SELECT COALESCE(SUM(api_cost_usd), 0)::text AS sum
    FROM pipeline_runs
    WHERE date_trunc('month', started_at) = date_trunc('month', NOW())
      AND status IN ('completed', 'running')
  `);
  const r = rows[0];
  if (!r) return 0;
  return parseFloat(r.sum ?? "0");
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

export async function hourlySpendUsd(): Promise<number> {
  const rows = await db.execute<{ sum: string | null }>(sql`
    SELECT COALESCE(SUM(api_cost_usd), 0)::text AS sum
    FROM pipeline_runs
    WHERE started_at > NOW() - INTERVAL '1 hour'
      AND status IN ('completed', 'running')
  `);
  const r = rows[0];
  if (!r) return 0;
  return parseFloat(r.sum ?? "0");
}

/**
 * Throws BudgetExceeded if any of the three running totals (monthly,
 * daily, hourly) plus the estimated cost would breach its cap. Call
 * before every Gateway invocation. Monthly is the user's pocket-cost
 * ceiling; daily and hourly are smoothers that prevent the whole month
 * burning in one day or hour.
 */
export async function checkBudget(estimatedCost: number): Promise<void> {
  const [monthly, daily, hourly] = await Promise.all([
    monthlySpendUsd(),
    todaysSpendUsd(),
    hourlySpendUsd(),
  ]);
  if (monthly + estimatedCost > MONTHLY_BUDGET_USD) {
    throw new BudgetExceeded(
      monthly,
      estimatedCost,
      MONTHLY_BUDGET_USD,
      "monthly",
    );
  }
  if (daily + estimatedCost > DAILY_BUDGET_USD) {
    throw new BudgetExceeded(daily, estimatedCost, DAILY_BUDGET_USD, "daily");
  }
  if (hourly + estimatedCost > BURN_PER_HOUR_USD) {
    throw new BudgetExceeded(
      hourly,
      estimatedCost,
      BURN_PER_HOUR_USD,
      "hourly",
    );
  }
}
