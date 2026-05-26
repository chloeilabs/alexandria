// Thread detail: a linear walk through 5-10 entities, each preceded by
// the editorial bridge note that frames its place in the story. Rendered
// SCRIPTORIUM-style: centred editorial header, numbered `Caput` markers
// before each entry, and a hairline-rule between stops.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { getThreadBySlug } from "@/lib/db/queries/thread";
import { fmtYear, firstSentence } from "@/lib/format";
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
  const data = await getThreadBySlug(slug);
  if (!data) return { title: "Not found" };
  const description =
    data.blurb ?? `A path of ${data.entries.length} entries.`;
  return {
    title: `${data.title} · Alexandria`,
    description,
    openGraph: { title: data.title, description, type: "article" },
  };
}

const BASE_URL = "https://alexandria.chloei.ai";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
function romanNumeral(n: number): string {
  return ROMAN[n - 1] ?? String(n);
}

export default async function ThreadRoute({ params }: PageProps) {
  const { slug } = await params;
  const data = await getThreadBySlug(slug);
  if (!data) notFound();

  const ldJson = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.title,
    description: data.blurb ?? data.intro?.slice(0, 200) ?? "",
    url: `${BASE_URL}/thread/${slug}`,
    inLanguage: "en",
    author: { "@type": "Organization", name: "Alexandria", url: BASE_URL },
    publisher: { "@type": "Organization", name: "Alexandria", url: BASE_URL },
    isAccessibleForFree: true,
    mainEntity: {
      "@type": "ItemList",
      name: data.title,
      numberOfItems: data.entries.length,
      itemListElement: data.entries.map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE_URL}/entity/${e.slug}`,
        name: e.name,
      })),
    },
  };

  return (
    <article className="min-h-screen pb-32 codex-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />

      <div className="max-w-4xl mx-auto px-6 pt-20 pb-12">
        <EditorialPageHeader
          kicker="Itinerarium lectoris"
          title={data.title}
          titleSize={72}
          blurb={data.blurb}
          meta={`${data.entries.length} ${data.entries.length === 1 ? "stop" : "stops"}${data.featured ? "  ·  featured" : ""}`}
        />
        {data.intro && (
          <p
            className="font-display mx-auto mt-10"
            style={{
              fontSize: 19,
              lineHeight: 1.65,
              color: "var(--color-foreground)",
              maxWidth: 720,
              textAlign: "justify",
              hyphens: "auto",
            }}
          >
            {data.intro}
          </p>
        )}
      </div>

      <ol className="max-w-3xl mx-auto px-6 space-y-16 mt-4">
        {data.entries.map((e, idx) => (
          <li key={e.qid} className="relative">
            <div
              className="flex items-baseline gap-4 mb-6"
              aria-hidden="true"
            >
              <span
                className="font-display italic"
                style={{
                  fontSize: 13,
                  letterSpacing: "0.18em",
                  color: "var(--color-accent)",
                  textTransform: "uppercase",
                }}
              >
                Caput {romanNumeral(idx + 1)}
              </span>
              <span
                className="flex-1 h-px"
                style={{ background: "var(--color-foreground)" }}
              />
            </div>

            {e.note && (
              <p
                className="font-display italic mb-6"
                style={{
                  fontSize: 18,
                  lineHeight: 1.6,
                  color: "var(--color-muted-foreground)",
                  borderLeft: "2px solid var(--color-accent)",
                  paddingLeft: 20,
                }}
              >
                {e.note}
              </p>
            )}

            <Link
              href={`/entity/${e.slug}`}
              className="group flex gap-6 items-start no-underline focus:outline-none focus-visible:outline-1 focus-visible:outline-accent focus-visible:outline-offset-4"
              prefetch={false}
            >
              <div
                className="relative shrink-0 overflow-hidden"
                style={{
                  width: 128,
                  height: 128,
                  background: "var(--color-background-elevated)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {e.heroUrl ? (
                  <Image
                    src={e.heroUrl}
                    alt=""
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                ) : (
                  <PlaceholderPlate
                    slug={e.slug}
                    tone={toneFor(e.name)}
                    tier={e.tier}
                    height={128}
                    showCaption={false}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap mb-2">
                  <Display
                    size={32}
                    weight={400}
                    as="h2"
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
                    {firstSentence(e.summary, 240)}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ol>

      <div
        className="max-w-3xl mx-auto px-6 mt-20 pt-8"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <Link
          href="/thread"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
        >
          ← all threads
        </Link>
      </div>
    </article>
  );
}
