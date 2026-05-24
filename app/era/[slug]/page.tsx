// Era detail page: every entity whose date_start falls in this era,
// grouped by civilization (parallel to /civilization/[slug] which
// groups by era). Lets the reader scan one era across many parts of
// the world at once.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { getEraBySlug, eraById, type EraEntry } from "@/lib/db/queries/era";
import { ERAS } from "@/lib/search";
import { fmtYear, regionLabel, firstSentence } from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const era = eraById(slug);
  if (!era) return { title: "Not found" };
  const description = `Browse the ${era.label.toLowerCase()} era of the Library — ${fmtYear(era.min)} to ${fmtYear(era.max)}.`;
  return {
    title: `${era.label} · Alexandria`,
    description,
    openGraph: { title: era.label, description, type: "website" },
  };
}

const UNCATEGORIZED = "uncategorized";

function groupByCivilization(
  entries: EraEntry[],
): Array<{ tag: string; entries: EraEntry[] }> {
  // Bucket by primary (first) civ tag; entities with no civ tag go in
  // the uncategorized bucket so they're still visible.
  const buckets = new Map<string, EraEntry[]>();
  for (const e of entries) {
    const primary = e.civTags[0] ?? UNCATEGORIZED;
    const arr = buckets.get(primary);
    if (arr) arr.push(e);
    else buckets.set(primary, [e]);
  }
  // Order buckets by size desc, then alphabetical for stability.
  // Uncategorized always last regardless of size.
  return [...buckets.entries()]
    .map(([tag, entries]) => ({ tag, entries }))
    .sort((a, b) => {
      if (a.tag === UNCATEGORIZED) return 1;
      if (b.tag === UNCATEGORIZED) return -1;
      const sizeDiff = b.entries.length - a.entries.length;
      return sizeDiff !== 0 ? sizeDiff : a.tag.localeCompare(b.tag);
    });
}

const BASE_URL = "https://alexandria.chloei.ai";

export default async function EraRoute({ params }: PageProps) {
  const { slug } = await params;
  const data = await getEraBySlug(slug);
  if (!data) notFound();

  const groups = groupByCivilization(data.entries);

  // Build prev/next era links from the ERAS array.
  const eraIndex = ERAS.findIndex((e) => e.id === data.id);
  const prevEra = eraIndex > 0 ? ERAS[eraIndex - 1] : null;
  const nextEra = eraIndex < ERAS.length - 1 ? ERAS[eraIndex + 1] : null;

  // schema.org CollectionPage JSON-LD.
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `The ${data.label} era`,
    description: `${data.entryCount} entries from the ${data.label.toLowerCase()} era of the Library — ${fmtYear(data.min)} to ${fmtYear(data.max)}.`,
    url: `${BASE_URL}/era/${slug}`,
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

  return (
    <main className="min-h-screen pb-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6">
          Era
          {`  ·  ${fmtYear(data.min)} – ${fmtYear(data.max)}`}
          {`  ·  ${data.entryCount} ${data.entryCount === 1 ? "entry" : "entries"}`}
        </div>
        <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.02] tracking-tight text-foreground">
          The {data.label} era
        </h1>
      </header>

      <div className="max-w-3xl mx-auto px-6 space-y-20">
        {groups.map((g) => (
          <section key={g.tag}>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-8 border-t border-border pt-8">
              {g.tag === UNCATEGORIZED ? (
                "Without a civilization"
              ) : (
                <Link
                  href={`/civilization/${g.tag}`}
                  className="hover:text-foreground transition-colors focus:outline-none focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-4"
                >
                  {regionLabel(g.tag)}
                </Link>
              )}
            </h2>
            <ul className="space-y-10">
              {g.entries.map((e) => (
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
                          {`  ·  ${fmtYear(e.dateStart, e.dateStartPrecision)}`}
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

        {(prevEra || nextEra) && (
          <nav className="grid grid-cols-2 gap-6 border-t border-border pt-8 mt-4">
            <div>
              {prevEra && (
                <Link
                  href={`/era/${prevEra.id}`}
                  className="group block focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground block mb-2">
                    ← Earlier
                  </span>
                  <span className="font-display text-2xl text-foreground group-hover:text-accent transition-colors">
                    {prevEra.label}
                  </span>
                </Link>
              )}
            </div>
            <div className="text-right">
              {nextEra && (
                <Link
                  href={`/era/${nextEra.id}`}
                  className="group block focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground block mb-2">
                    Later →
                  </span>
                  <span className="font-display text-2xl text-foreground group-hover:text-accent transition-colors">
                    {nextEra.label}
                  </span>
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </main>
  );
}
