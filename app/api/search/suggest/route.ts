// Lightweight typeahead endpoint for the search box. Prefix/substring match
// on names + aliases — NO embedding call, so it's safe to hit per keystroke.
// Full semantic (hybrid) search still happens on /search via hybridSearch.

import { NextResponse } from "next/server";

import { suggestEntities } from "@/lib/db/queries/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return NextResponse.json({ suggestions: [] });
  }
  try {
    const suggestions = await suggestEntities(q, 8);
    return NextResponse.json(
      { suggestions },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    // Typeahead is best-effort — never surface a 500 to the search box.
    return NextResponse.json({ suggestions: [] });
  }
}
