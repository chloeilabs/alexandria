// RSS 2.0 feed of all curated threads. Reachable at /threads.xml.
// Subscribers see new threads as they're added; each item links into
// the corresponding /thread/[slug] page.
//
// We escape titles + blurbs minimally — the seed data doesn't contain
// HTML, but defensive escaping prevents an editorial copy-paste from
// breaking the feed XML.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { withRetry } from "@/lib/db/retry";
import { threads } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

const BASE_URL = "https://alexandria-chloei.vercel.app";

export const dynamic = "force-dynamic";
// RSS is small; revalidate per minute is plenty.
export const revalidate = 60;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const rows = await withRetry("threads.xml", () =>
    db
      .select({
        slug: threads.slug,
        title: threads.title,
        blurb: threads.blurb,
        createdAt: threads.createdAt,
        updatedAt: threads.updatedAt,
      })
      .from(threads)
      .orderBy(desc(threads.createdAt)),
  );

  const lastBuildDate = rows[0]?.updatedAt ?? new Date();

  const items = rows
    .map((t) => {
      const link = `${BASE_URL}/thread/${t.slug}`;
      const title = escapeXml(t.title);
      const description = escapeXml(t.blurb ?? "");
      const pubDate = t.createdAt.toUTCString();
      return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Alexandria · Threads</title>
    <link>${BASE_URL}/thread</link>
    <atom:link href="${BASE_URL}/threads.xml" rel="self" type="application/rss+xml" />
    <description>Curated paths through The Library of Alexandria — five to seven entries that tell a continuous story.</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
