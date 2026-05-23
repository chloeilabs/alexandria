import { NextResponse, type NextRequest } from "next/server";
import {
  ENTITY_TYPES,
  ERAS,
  type EntityTypeFilter,
  type EraId,
  searchByText,
} from "@/lib/search";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const limit = Math.min(Number(sp.get("limit") ?? 20), 50);
  const type = ENTITY_TYPES.find((t) => t === sp.get("type")) as
    | EntityTypeFilter
    | undefined;
  const era = ERAS.find((e) => e.id === sp.get("era"))?.id as EraId | undefined;
  const hits = await searchByText(q, { type, era }, limit);
  return NextResponse.json({ q, count: hits.length, hits });
}
