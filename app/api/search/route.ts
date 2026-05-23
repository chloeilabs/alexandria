import { NextResponse, type NextRequest } from "next/server";
import { searchByText } from "@/lib/search";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? 20),
    50,
  );
  const hits = await searchByText(q, limit);
  return NextResponse.json({ q, count: hits.length, hits });
}
