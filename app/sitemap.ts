import type { MetadataRoute } from "next";
import { desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { entities, entityTopics } from "@/lib/db/schema";
import { withRetry } from "@/lib/db/retry";

const SITE_URL = "https://alexandria.chloei.ai";

export const revalidate = 3600; // refresh hourly

// Distinct entity types we generate browse pages for.
const BROWSE_TYPES = [
  "person",
  "place",
  "event",
  "concept",
  "work",
  "organization",
  "species",
  "artifact",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${SITE_URL}/browse`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/quality`, lastModified: now, changeFrequency: "daily", priority: 0.4 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  const browseTypePages: MetadataRoute.Sitemap = BROWSE_TYPES.map((type) => ({
    url: `${SITE_URL}/browse/${type}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const [entityRows, topicRows] = await Promise.all([
    withRetry("sitemap:entities", () =>
      db
        .select({
          slug: entities.slug,
          updatedAt: entities.updatedAt,
          publishedAt: entities.publishedAt,
        })
        .from(entities)
        .where(eq(entities.status, "published"))
        .orderBy(desc(entities.publishedAt)),
    ),
    withRetry("sitemap:topics", () =>
      db
        .selectDistinct({ topic: entityTopics.topic })
        .from(entityTopics)
        .where(isNotNull(entityTopics.topic)),
    ),
  ]);

  const entityPages: MetadataRoute.Sitemap = entityRows.map((e) => ({
    url: `${SITE_URL}/entity/${encodeURIComponent(e.slug)}`,
    lastModified: e.updatedAt ?? e.publishedAt ?? now,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const topicPages: MetadataRoute.Sitemap = topicRows.map((t) => ({
    url: `${SITE_URL}/topic/${encodeURIComponent(t.topic)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticPages, ...browseTypePages, ...entityPages, ...topicPages];
}
