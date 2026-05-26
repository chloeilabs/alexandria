// Civilization landing page: every entity tagged with the given civ slug,
// organized chronologically, with adjacent civilizations to hop sideways.
// Rendered SCRIPTORIUM-style: centred editorial header, era group
// markers, and entity cards consistent with the thread / era detail
// templates.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import {
  getCivilizationBySlug,
  getAllCivilizationSlugs,
} from "@/lib/db/queries/civilization";
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
    openGraph: { title: label, description, type: "website" },
  };
}

const BASE_URL = "https://alexandria.chloei.ai";

export default async function CivilizationRoute({ params }: PageProps) {
  const { slug } = await params;
  const data = await getCivilizationBySlug(slug);
  if (!data) notFound();

  const label = regionLabel(slug);
  const span =
    data.minYear != null && data.maxYear != null
      ? `${fmtYear(data.minYear)} – ${fmtYear(data.maxYear)}`
      : null;

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
        (e) =>
          e.dateStart != null && e.dateStart >= b.min && e.dateStart < b.max,
      ),
    }))
    .filter((b) => b.entries.length > 0);

  const meta =
    `${data.entryCount} ${data.entryCount === 1 ? "entry" : "entries"}` +
    (span ? `  ·  ${span}` : "");

  return (
    <main className="min-h-screen pb-32 codex-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />

      <div className="max-w-4xl mx-auto px-6 pt-20 pb-12">
        <EditorialPageHeader
          kicker="Capitulum civilizationis"
          title={label}
          titleSize={84}
          meta={meta}
          blurb={`A chapter of the volume, organised chronologically — every entry the Library currently holds for ${label}, with adjacent civilisations to wander into at the foot of the page.`}
        />
      </div>

      <div className="max-w-3xl mx-auto px-6 space-y-20">
        {grouped.map((bucket) => (
          <section key={bucket.label}>
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
                ¶ {bucket.label}
              </span>
              <MonoLabel size={10} track="0.18em" tone="muted">
                {bucket.entries.length}{" "}
                {bucket.entries.length === 1 ? "entry" : "entries"}
              </MonoLabel>
            </div>
            <ul className="space-y-10">
              {bucket.entries.map((e) => (
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
                          tone={toneFor(label)}
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
                          {e.dateStart != null
                            ? `  ·  ${fmtYear(e.dateStart, e.dateStartPrecision)}`
                            : ""}
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

        {undated.length > 0 && (
          <section>
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
                ¶ Without dates
              </span>
              <MonoLabel size={10} track="0.18em" tone="muted">
                {undated.length}{" "}
                {undated.length === 1 ? "entry" : "entries"}
              </MonoLabel>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {undated.map((e) => (
                <li key={e.qid}>
                  <Link
                    href={`/entity/${e.slug}`}
                    className="group flex items-baseline gap-3 flex-wrap focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                    prefetch={false}
                  >
                    <span
                      className="font-display group-hover:text-accent transition-colors"
                      style={{
                        fontSize: 18,
                        color: "var(--color-foreground)",
                      }}
                    >
                      {e.name}
                    </span>
                    <MonoLabel size={10} track="0.16em" tone="muted">
                      {e.type}
                    </MonoLabel>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.adjacent.length > 0 && (
          <section>
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
                ¶ Threads sideways
              </span>
              <MonoLabel size={10} track="0.18em" tone="muted">
                {data.adjacent.length}{" "}
                {data.adjacent.length === 1
                  ? "civilization"
                  : "civilizations"}
              </MonoLabel>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {data.adjacent.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/civilization/${a.slug}`}
                    className="group flex items-baseline justify-between gap-3 flex-wrap focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                    prefetch={false}
                  >
                    <span
                      className="font-display group-hover:text-accent transition-colors"
                      style={{
                        fontSize: 18,
                        color: "var(--color-foreground)",
                      }}
                    >
                      {regionLabel(a.slug)}
                    </span>
                    <MonoLabel size={10} track="0.18em">
                      {a.overlap} shared
                    </MonoLabel>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div
          className="pt-8 mt-12"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <Link
            href="/civilization"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
          >
            ← all civilizations
          </Link>
        </div>
      </div>
    </main>
  );
}

export async function generateStaticParams() {
  const civs = await getAllCivilizationSlugs();
  return civs.map((c) => ({ slug: c.slug }));
}
