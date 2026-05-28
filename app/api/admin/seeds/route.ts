import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { seedTopics } from "@/lib/db/schema";
import { withRetry } from "@/lib/db/retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SeedRequest {
  text: string;
  batchLabel?: string | null;
}

function parseLines(text: string): Array<{ name: string; hint: string | null }> {
  const out: Array<{ name: string; hint: string | null }> = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split("|").map((s) => s.trim());
    const name = parts[0];
    if (!name) continue;
    const hint = parts.length > 1 ? parts.slice(1).join(" | ") : null;
    out.push({ name, hint });
  }
  return out;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // The /api/admin/* matcher in middleware.ts already enforces auth.
  let body: SeedRequest;
  try {
    body = (await req.json()) as SeedRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const seeds = parseLines(body.text ?? "");
  if (!seeds.length) {
    return NextResponse.json({ error: "no_seeds" }, { status: 400 });
  }

  const inserted = await withRetry("insertSeeds", async () =>
    db
      .insert(seedTopics)
      .values(
        seeds.map((s) => ({
          name: s.name,
          hint: s.hint,
          batchLabel: body.batchLabel ?? null,
        })),
      )
      .returning({ id: seedTopics.id }),
  );

  return NextResponse.json({ inserted: inserted.length });
}
