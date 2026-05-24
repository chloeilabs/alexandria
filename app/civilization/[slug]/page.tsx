// Civilization landing page: every entity tagged with the given civ slug,
// organized chronologically, with adjacent civilizations to hop sideways.
//
// Hits Postgres at request time (force-dynamic) — Vercel's static prerender
// can't reach Neon reliably during build, same reason the other DB-backed
// pages declare dynamic.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import {
  getCivilizationBySlug,
  getAllCivilizationSlugs,
} from "@/lib/db/queries/civilization";
import { fmtYear, regionLabel, firstSentence } from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const label = regionLabel(slug);
  const data = await getCivilizationBySlug(slug);
  if (!data) return { title: "Not found" };
  const span =
    data.minYear != null && data.maxYear != null
      ? `${fmtYear(data.minYear)} – ${fmtYear(data.maxYear)}`
      : "";
  const description =
    `Browse ${data.entryCount} entries from ${label}` +
    (span ? `, spanning ${span}.` : ".");
  return {
    title: `${label} · Alexandria`,
    description,
    openGraph: {
      title: label,
      description,
      type: "website",
    },
  };
}

const BASE_URL = "https://alexandria-chloei.vercel.app";

export default async function CivilizationRoute({ params }: PageProps) {
  const { slug } = await params;
  const data = await getCivilizationBySlug(slug);
  if (!data) notFound();

  const label = regionLabel(slug);
  const span =
    data.minYear != null && data.maxYear != null
      ? `${fmtYear(data.minYear)} – ${fmtYear(data.maxYear)}`
      : null;

  // schema.org CollectionPage JSON-LD — a structured "this is a curated
  // listing of N entities sharing a tag" signal for search engines + LLMs.
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: label,
    description:
      `${data.entryCount} entries from ${label}` +
      (span ? `, spanning ${span}.` : "."),
    url: `${BASE_URL}/civilization/${slug}`,
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", name: "Alexandria", url: BASE_URL },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: data.entries.length,
      itemListElement: data.entries.slice(0, 100).map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE_URL}/entity/${e.slug}`,
        name: e.name,
      })),
    },
  };

  // Group entries by century-ish era so the long page has visible rhythm.
  const buckets: { label: string; min: number; max: number }[] = [
    { label: "Ancient", min: -10_000, max: -1000 },
    { label: "Classical", min: -1000, max: 500 },
    { label: "Medieval", min: 500, max: 1500 },
    { label: "Early Modern", min: 1500, max: 1800 },
    { label: "Modern", min: 1800, max: 3000 },
  ];
  const undated = data.entries.filter((e) => e.dateStart == null);
  const grouped = buckets
    .map((b) => ({
      ...b,
      entries: data.entries.filter(
        (e) => e.dateStart != null && e.dateStart >= b.min && e.dateStart < b.max,
      ),
    }))
    .filter((b) => b.entries.length > 0);

  return (
    <main className="min-h-screen pb-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6">
          Civilization
          {span ? `  ·  ${span}` : ""}
          {`  ·  ${data.entryCount} ${data.entryCount === 1 ? "entry" : "entries"}`}
        </div>
        <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.02] tracking-tight text-foreground">
          {label}
        </h1>
      </header>

      <div className="max-w-3xl mx-auto px-6 space-y-20">
        {grouped.map((bucket) => (
          <section key={bucket.label}>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-8 border-t border-border pt-8">
              {bucket.label}
            </h2>
            <ul className="space-y-10">
              {bucket.entries.map((e) => (
                <li key={e.qid}>
                  <Link
                    href={`/entity/${e.slug}`}
                    className="group flex gap-6 items-start focus:outline-none focus-visible:outline-1 focus-visible:outline-accent focus-visible:outline-offset-4"
                  >
                    {e.heroUrl && (
                      <div className="relative w-24 h-24 shrink-0 overflow-hidden bg-card border border-border/40">
                        <Image
                          src={e.heroUrl}
                          alt=""
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap mb-1">
                        <h3 className="font-display text-2xl text-foreground group-hover:text-accent transition-colors">
                          {e.name}
                        </h3>
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          {e.type}
                          {e.dateStart != null
                            ? `  ·  ${fmtYear(e.dateStart, e.dateStartPrecision)}`
                            : ""}
                        </span>
                      </div>
                      {e.summary && (
                        <p className="text-base leading-relaxed text-muted-foreground">
                          {firstSentence(e.summary, 220)}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {undated.length > 0 && (
          <section>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-8 border-t border-border pt-8">
              Without dates
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {undated.map((e) => (
                <li key={e.qid}>
                  <Link
                    href={`/entity/${e.slug}`}
                    className="group flex items-baseline gap-3 flex-wrap focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                  >
                    <span className="font-display text-lg text-foreground group-hover:text-accent transition-colors">
                      {e.name}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {e.type}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.adjacent.length > 0 && (
          <section>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-8 border-t border-border pt-8">
              Threads through
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {data.adjacent.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/civilization/${a.slug}`}
                    className="group flex items-baseline gap-3 flex-wrap focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                  >
                    <span className="font-display text-lg text-foreground group-hover:text-accent transition-colors">
                      {regionLabel(a.slug)}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {a.overlap} shared{a.overlap === 1 ? " entry" : " entries"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

export async function generateStaticParams() {
  // Although the page is force-dynamic, providing params keeps the slug
  // index handy for any future static-export path; harmless to include.
  const civs = await getAllCivilizationSlugs();
  return civs.map((c) => ({ slug: c.slug }));
}
