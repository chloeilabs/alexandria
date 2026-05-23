// pg-boss queue — uses the same Postgres as the rest of the app
// (DECISIONS.md: pg-boss on Postgres, NOT Valkey + BullMQ).
//
// On first start, pg-boss creates its own `pgboss` schema with tables for
// jobs, schedules, archive, etc. Subsequent starts are no-ops.

import "../lib/env";
import { PgBoss } from "pg-boss";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://library:changeme@localhost:5434/library";

export const boss = new PgBoss({
  connectionString,
  schema: "pgboss",
});

let started = false;

export async function startQueue(): Promise<void> {
  if (started) return;
  boss.on("error", (err: unknown) => {
    console.error("[pg-boss error]", err);
  });
  await boss.start();
  started = true;
  console.log("[queue] pg-boss started");
}

export async function stopQueue(): Promise<void> {
  if (!started) return;
  await boss.stop({ graceful: true, timeout: 60_000 });
  started = false;
}
