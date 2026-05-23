import { NextResponse, type NextRequest } from "next/server";
import {
  ENTITY_TYPES,
  ERAS,
  type EntityTypeFilter,
  type EraId,
  search,
  searchByText,
  searchByVector,
} from "@/lib/search";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const limit = Math.min(Number(sp.get("limit") ?? 20), 50);
  const type = ENTITY_TYPES.find((t) => t === sp.get("type")) as
    | EntityTypeFilter
    | undefined;
  const era = ERAS.find((e) => e.id === sp.get("era"))?.id as EraId | undefined;

  // `?mode=fts|vector|hybrid` (default hybrid). Useful for debugging which
  // leg is contributing what to a given query.
  const mode = (sp.get("mode") ?? "hybrid") as "fts" | "vector" | "hybrid";
  const hits =
    mode === "fts"
      ? await searchByText(q, { type, era }, limit)
      : mode === "vector"
        ? await searchByVector(q, { type, era }, limit)
        : await search(q, { type, era }, limit);

  return NextResponse.json({ q, mode, count: hits.length, hits });
}
