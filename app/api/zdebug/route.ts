// Temporary debug endpoint — verifies what DATABASE_URL the runtime actually
// resolves and runs a count(*) against entities. Delete after diagnosing.

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { entities } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function maskUrl(u: string | undefined): string {
  if (!u) return "(unset)";
  return u
    .replace(/:[^@/]+@/, ":<redacted>@")
    .replace(/(host=)[^&]+/i, "$1<redacted>");
}

export async function GET() {
  const result: Record<string, unknown> = {
    DATABASE_URL: maskUrl(process.env.DATABASE_URL),
    DATABASE_URL_UNPOOLED: maskUrl(process.env.DATABASE_URL_UNPOOLED),
    POSTGRES_URL: maskUrl(process.env.POSTGRES_URL),
    PGHOST: process.env.PGHOST ?? "(unset)",
    NEON_PROJECT_ID: process.env.NEON_PROJECT_ID ?? "(unset)",
  };

  try {
    const rows = await db.execute<{ n: number }>(
      sql`SELECT COUNT(*)::int AS n FROM entities`,
    );
    result.rawEntitiesCount = rows[0]?.n ?? null;
  } catch (e) {
    result.rawEntitiesError = e instanceof Error ? e.message : String(e);
  }

  try {
    const rows = await db.execute<{ table_name: string }>(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`,
    );
    result.tables = rows.map((r) => r.table_name);
  } catch (e) {
    result.tablesError = e instanceof Error ? e.message : String(e);
  }

  try {
    const rows = await db.execute<{ p: string }>(sql`SHOW search_path`);
    result.searchPath = rows[0]?.p ?? null;
  } catch (e) {
    result.searchPathError = e instanceof Error ? e.message : String(e);
  }

  try {
    const rows = await db.execute<{ db: string; usr: string }>(
      sql`SELECT current_database() AS db, current_user AS usr`,
    );
    result.identity = rows[0] ?? null;
  } catch (e) {
    result.identityError = e instanceof Error ? e.message : String(e);
  }

  // The actual failing path: Drizzle query builder from(entities)
  try {
    const rows = await db.select({ qid: entities.qid }).from(entities).limit(1);
    result.drizzleSelect = { ok: true, sample: rows[0]?.qid ?? null };
  } catch (e) {
    result.drizzleSelect = {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json(result);
}
