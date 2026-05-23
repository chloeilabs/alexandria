// Temporary debug endpoint — verifies what DATABASE_URL the runtime actually
// resolves and runs a count(*) against entities. Delete after diagnosing.

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

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
    result.entitiesCount = rows[0]?.n ?? null;
  } catch (e) {
    result.entitiesError = e instanceof Error ? e.message : String(e);
  }

  try {
    const rows = await db.execute<{ table_name: string }>(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`,
    );
    result.tables = rows.map((r) => r.table_name);
  } catch (e) {
    result.tablesError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(result);
}
