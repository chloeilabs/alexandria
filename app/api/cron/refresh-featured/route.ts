import { NextResponse, type NextRequest } from "next/server";

import { refreshTodaysFeatured } from "@/lib/db/queries/featured";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FEATURED_COUNT = 8;

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${expected}`) return true;
  // Vercel Cron sets x-vercel-cron header on scheduled invocations.
  if (req.headers.get("x-vercel-cron")) return true;
  return false;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await refreshTodaysFeatured({ count: FEATURED_COUNT });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return GET(req);
}
