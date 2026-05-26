// Era detail page: every entity whose date_start falls in this era,
// grouped by civilization (parallel to /civilization/[slug] which
// groups by era). SCRIPTORIUM-style header + group dividers + prev/
// next era pagination.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { getEraBySlug, eraById, type EraEntry } from "@/lib/db/queries/era";
import { ERAS } from "@/lib/search";
import { fmtYear, regionLabel, firstSentence } from "@/lib/format";
import {
  EditorialPageHeader,
  MonoLabel,
  Display,
} from "@/components/scriptorium/primitives";
import { PlaceholderPlate, toneFor } from "@/components/scriptorium/PlaceholderPlate";

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
  const buckets = new Map<string, EraEntry[]>();
  for (const e of entries) {
    const primary = e.civTags[0] ?? UNCATEGORIZED;
    const arr = buckets.get(primary);
    if (arr) arr.push(e);
    else buckets.set(primary, [e]);
  }
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

  const eraIndex = ERAS.findIndex((e) => e.id === data.id);
  const prevEra = eraIndex > 0 ? ERAS[eraIndex - 1] : null;
  const nextEra = eraIndex < ERAS.length - 1 ? ERAS[eraIndex + 1] : null;

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

  const meta =
    `${data.entryCount} ${data.entryCount === 1 ? "entry" : "entries"}  ·  ${fmtYear(data.min)} – ${fmtYear(data.max)}`;

  return (
    <main className="min-h-screen pb-32 codex-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />

      <div className="max-w-4xl mx-auto px-6 pt-20 pb-12">
        <EditorialPageHeader
          kicker="Lectiones aetatis"
          title={`The ${data.label} era.`}
          titleSize={72}
          meta={meta}
          blurb={`Read across the world at once. The ${data.label.toLowerCase()} era, grouped by civilisation — every entry the Library currently holds for these years.`}
        />
      </div>

      <div className="max-w-3xl mx-auto px-6 space-y-20">
        {groups.map((g) => (
          <section key={g.tag}>
            <div
              className="flex items-baseline justify-between mb-8 pb-2 border-b"
              style={{ borderColor: "var(--color-accent)" }}
            >
              <span
                className="font-display italic uppercase"
                style={{
                  fontSize: 18,
                  letterSpacing: "0.18em",
                  color: "var(--color-accent)",
                }}
              >
                {g.tag === UNCATEGORIZED ? (
                  "¶ Without a civilization"
                ) : (
                  <>
                    ¶{" "}
                    <Link
                      href={`/civilization/${g.tag}`}
                      className="hover:text-foreground transition-colors focus:outline-none focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-4"
                    >
                      {regionLabel(g.tag)}
                    </Link>
                  </>
                )}
              </span>
              <MonoLabel size={10} track="0.18em" tone="muted">
                {g.entries.length}{" "}
                {g.entries.length === 1 ? "entry" : "entries"}
              </MonoLabel>
            </div>
            <ul className="space-y-10">
              {g.entries.map((e) => (
                <li key={e.qid}>
                  <Link
                    href={`/entity/${e.slug}`}
                    className="group flex gap-6 items-start no-underline focus:outline-none focus-visible:outline-1 focus-visible:outline-accent focus-visible:outline-offset-4"
                    prefetch={false}
                  >
                    <div
                      className="relative shrink-0 overflow-hidden"
                      style={{
                        width: 96,
                        height: 96,
                        background: "var(--color-background-elevated)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      {e.heroUrl ? (
                        <Image
                          src={e.heroUrl}
                          alt=""
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      ) : (
                        <PlaceholderPlate
                          slug={e.slug}
                          tone={toneFor(g.tag)}
                          tier={e.tier}
                          height={96}
                          showCaption={false}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap mb-1">
                        <Display
                          size={26}
                          weight={400}
                          as="h3"
                          className="group-hover:text-accent transition-colors"
                          style={{ letterSpacing: "-0.012em", lineHeight: 1 }}
                        >
                          {e.name}
                        </Display>
                        <MonoLabel size={10} track="0.18em" tone="muted">
                          {e.type}
                          {`  ·  ${fmtYear(e.dateStart, e.dateStartPrecision)}`}
                        </MonoLabel>
                      </div>
                      {e.summary && (
                        <p
                          className="font-display"
                          style={{
                            fontSize: 16,
                            lineHeight: 1.6,
                            color: "var(--color-muted-foreground)",
                          }}
                        >
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
          <nav
            className="grid grid-cols-2 gap-6 pt-8 mt-4"
            style={{ borderTop: "1px solid var(--color-border)" }}
            aria-label="Era navigation"
          >
            <div>
              {prevEra && (
                <Link
                  href={`/era/${prevEra.id}`}
                  className="group block no-underline focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                  prefetch={false}
                >
                  <MonoLabel
                    size={10}
                    track="0.22em"
                    tone="muted"
                    className="block mb-2"
                  >
                    ← Earlier
                  </MonoLabel>
                  <Display
                    size={28}
                    weight={400}
                    italic
                    className="group-hover:text-accent transition-colors"
                    style={{ letterSpacing: "-0.012em", lineHeight: 1 }}
                  >
                    {prevEra.label}
                  </Display>
                </Link>
              )}
            </div>
            <div className="text-right">
              {nextEra && (
                <Link
                  href={`/era/${nextEra.id}`}
                  className="group block no-underline focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                  prefetch={false}
                >
                  <MonoLabel
                    size={10}
                    track="0.22em"
                    tone="muted"
                    className="block mb-2"
                  >
                    Later →
                  </MonoLabel>
                  <Display
                    size={28}
                    weight={400}
                    italic
                    className="group-hover:text-accent transition-colors"
                    style={{ letterSpacing: "-0.012em", lineHeight: 1 }}
                  >
                    {nextEra.label}
                  </Display>
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </main>
  );
}
