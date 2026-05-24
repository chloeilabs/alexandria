import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EntityPage } from "@/components/entity/EntityPage";
import { getEntityBySlug } from "@/lib/db/queries/entity";
import { firstSentence } from "@/lib/format";

const BASE_URL = "https://alexandria-chloei.vercel.app";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getEntityBySlug(slug);
  if (!data) return { title: "Not found" };
  const description =
    data.entity.summary?.slice(0, 160) ?? `Read about ${data.entity.name}.`;
  return {
    title: `${data.entity.name} · Alexandria`,
    description,
    openGraph: {
      title: data.entity.name,
      description,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: data.entity.name,
      description,
    },
  };
}

export default async function EntityRoute({ params }: PageProps) {
  const { slug } = await params;
  const data = await getEntityBySlug(slug);
  if (!data) notFound();

  // schema.org Article JSON-LD. Improves Google's rich-result eligibility
  // and gives LLM-based search tools structured signals about the entry
  // (named entity, dates, sources). Inlined as a single application/ld+json
  // script tag — standard pattern, no client JS, no perf cost.
  const ldJson = buildArticleLd(data, slug);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />
      <EntityPage data={data} />
    </>
  );
}

function buildArticleLd(
  data: NonNullable<Awaited<ReturnType<typeof getEntityBySlug>>>,
  slug: string,
): Record<string, unknown> {
  const { entity, sources, media } = data;
  const headline = entity.name;
  const description =
    entity.summary
      ? firstSentence(entity.summary, 200)
      : `An entry in Alexandria, a digital encyclopedia of human civilization.`;
  const url = `${BASE_URL}/entity/${slug}`;

  // datePublished — use tier_upgraded_at if available, else updatedAt.
  // Both are real timestamps in our DB.
  const datePublished = (entity.tierUpgradedAt ?? entity.updatedAt).toISOString();

  // image — first media url if present. Schema.org wants absolute URLs.
  const image = media[0]?.url;

  // citation — source URLs we built the narrative from.
  const citation = sources
    .map((s) => s.url)
    .filter((u): u is string => Boolean(u));

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    url,
    inLanguage: "en",
    datePublished,
    dateModified: entity.updatedAt.toISOString(),
    author: {
      "@type": "Organization",
      name: "Alexandria",
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Alexandria",
      url: BASE_URL,
    },
    ...(image && { image }),
    ...(citation.length > 0 && { citation }),
    isAccessibleForFree: true,
    license:
      sources.some((s) => s.sourceKind === "wikipedia")
        ? "https://creativecommons.org/licenses/by-sa/4.0/"
        : undefined,
  };
}
