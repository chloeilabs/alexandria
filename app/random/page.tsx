// /random redirects to a random Tier-2 entity. Useful for wandering;
// also useful as a fallback link when copy needs an "explore" CTA.
//
// Server-side redirect via Postgres TABLESAMPLE + ORDER BY RANDOM —
// fast enough at our corpus size that we don't bother with a cached
// pool of slugs.

import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { withRetry } from "@/lib/db/retry";

export const dynamic = "force-dynamic";

export default async function RandomEntityRoute() {
  const slug = await withRetry("randomEntitySlug", async () => {
    const rows = await db.execute<{ slug: string }>(sql`
      SELECT slug FROM entities
      WHERE tier >= 2
      ORDER BY RANDOM()
      LIMIT 1
    `);
    return Array.from(rows)[0]?.slug ?? null;
  });

  if (!slug) {
    // Edge case: corpus is empty or no Tier 2 entries yet. Send the user
    // somewhere useful rather than 500ing.
    redirect("/");
  }

  redirect(`/entity/${slug}`);
}
