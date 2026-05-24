// Thread detail: a linear walk through 5-10 entities, each preceded by
// the editorial bridge note that frames its place in the story. Each entry
// is a card with hero thumb + name + dates + the bridge note + first-
// sentence summary.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { getThreadBySlug } from "@/lib/db/queries/thread";
import { fmtYear, firstSentence } from "@/lib/format";

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
  const description = data.blurb ?? `A path of ${data.entries.length} entries.`;
  return {
    title: `${data.title} · Alexandria`,
    description,
    openGraph: { title: data.title, description, type: "article" },
  };
}

const BASE_URL = "https://alexandria.chloei.ai";

export default async function ThreadRoute({ params }: PageProps) {
  const { slug } = await params;
  const data = await getThreadBySlug(slug);
  if (!data) notFound();

  // schema.org Article + ItemList JSON-LD. Threads are curated reading
  // paths so the structure reads naturally as "an article that contains
  // an ordered list of N entity pages".
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
    <article className="min-h-screen pb-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6">
          Thread  ·  {data.entries.length} entries
        </div>
        <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.02] tracking-tight text-foreground">
          {data.title}
        </h1>
        {data.blurb && (
          <p className="mt-6 font-display italic text-xl leading-relaxed text-muted-foreground border-l-2 border-accent/40 pl-5">
            {data.blurb}
          </p>
        )}
        {data.intro && (
          <p className="mt-8 text-lg leading-[1.85] text-foreground">
            {data.intro}
          </p>
        )}
      </header>

      <ol className="max-w-3xl mx-auto px-6 space-y-16 mt-8">
        {data.entries.map((e, idx) => (
          <li key={e.qid} className="relative">
            <div className="flex items-baseline gap-4 mb-6">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 h-px bg-border" />
            </div>

            {e.note && (
              <p className="font-display italic text-lg leading-relaxed text-muted-foreground mb-6 border-l-2 border-accent/40 pl-5">
                {e.note}
              </p>
            )}

            <Link
              href={`/entity/${e.slug}`}
              className="group flex gap-6 items-start focus:outline-none focus-visible:outline-1 focus-visible:outline-accent focus-visible:outline-offset-4"
            >
              {e.heroUrl && (
                <div className="relative w-32 h-32 shrink-0 overflow-hidden bg-card border border-border/40">
                  <Image
                    src={e.heroUrl}
                    alt=""
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap mb-2">
                  <h2 className="font-display text-3xl text-foreground group-hover:text-accent transition-colors">
                    {e.name}
                  </h2>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {e.type}
                    {e.dateStart != null
                      ? `  ·  ${fmtYear(e.dateStart, e.dateStartPrecision)}`
                      : ""}
                  </span>
                </div>
                {e.summary && (
                  <p className="text-base leading-relaxed text-muted-foreground">
                    {firstSentence(e.summary, 240)}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ol>

      <div className="max-w-3xl mx-auto px-6 mt-20 pt-8 border-t border-border">
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
