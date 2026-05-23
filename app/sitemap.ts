// Dynamic sitemap. Lists every entity, civilization, era, thread —
// plus the canonical top-level routes — so search engines can crawl
// the whole library.
//
// Per Next.js convention, exporting a default function from
// app/sitemap.ts at the project root makes /sitemap.xml live
// automatically. Routes that read from the DB are pulled at request
// time (Next's revalidate semantics still apply on top of this).

import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { withRetry } from "@/lib/db/retry";
import { entities, threads } from "@/lib/db/schema";
import { getAllCivilizationSlugs } from "@/lib/db/queries/civilization";
import { ERAS } from "@/lib/search";

const BASE_URL = "https://alexandria-chloei.vercel.app";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch everything in parallel — each query already wraps withRetry.
  const [entityRows, civSlugs, threadRows] = await Promise.all([
    withRetry("sitemap:entities", () =>
      db
        .select({
          slug: entities.slug,
          updatedAt: entities.updatedAt,
          tier: entities.tier,
        })
        .from(entities),
    ),
    getAllCivilizationSlugs(),
    withRetry("sitemap:threads", () =>
      db
        .select({ slug: threads.slug, updatedAt: threads.updatedAt })
        .from(threads),
    ),
  ]);

  // Static / index pages — keep changeFrequency loose; lastModified
  // optional because the underlying content updates per-request.
  const indexes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/search`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/timeline`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/map`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/graph`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/civilization`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/era`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/thread`, changeFrequency: "weekly", priority: 0.8 },
  ];

  // Entity pages — bump priority for higher tiers so the canonical
  // long-form entries are crawled first if a budget is in play.
  const entityUrls: MetadataRoute.Sitemap = entityRows.map((e) => ({
    url: `${BASE_URL}/entity/${e.slug}`,
    lastModified: e.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.4 + Math.min(e.tier, 3) * 0.15,
  }));

  const civUrls: MetadataRoute.Sitemap = civSlugs.map((c) => ({
    url: `${BASE_URL}/civilization/${c.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const eraUrls: MetadataRoute.Sitemap = ERAS.map((e) => ({
    url: `${BASE_URL}/era/${e.id}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const threadUrls: MetadataRoute.Sitemap = threadRows.map((t) => ({
    url: `${BASE_URL}/thread/${t.slug}`,
    lastModified: t.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...indexes, ...entityUrls, ...civUrls, ...eraUrls, ...threadUrls];
}
