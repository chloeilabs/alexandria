import Link from "next/link";
import {
  getAllEntitySlugs,
  getFeaturedEntities,
} from "@/lib/db/queries/entity";
import { getFeaturedThread } from "@/lib/db/queries/thread";
import { fmtYear, regionLabel } from "@/lib/format";

// Force per-request rendering. The DB lives off the build VM (Neon),
// so static prerender would either fail or capture stale state. We'd
// rather render fresh per request and let Next's runtime cache layer
// (or our own ts_headline-based search hits) handle freshness.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [featured, allEntities, thread] = await Promise.all([
    getFeaturedEntities(12, 2),
    getAllEntitySlugs(200),
    getFeaturedThread(),
  ]);
  const hasContent = allEntities.length > 0;

  const regionCount = new Set(
    featured.map((f) => f.primaryTag).filter((t): t is string => t != null),
  ).size;
  const eraCount = new Set(featured.map((f) => f.era)).size;

  return (
    <main className="min-h-screen">
      <section className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <h1 className="font-display font-light text-6xl md:text-7xl leading-none tracking-tight text-foreground">
          Alexandria
        </h1>
        <p className="mt-6 font-display italic text-2xl text-muted-foreground max-w-xl leading-snug">
          A living digital encyclopedia of human civilization. Begin
          anywhere; follow the threads.
        </p>
        <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {hasContent ? `${allEntities.length} entries` : "Awaiting the seed"}
        </p>
      </section>

      {thread && (
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <div className="flex items-baseline justify-between mb-8 border-b border-border pb-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              Thread of the week
            </h2>
            <Link
              href="/thread"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-accent transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
            >
              all threads →
            </Link>
          </div>
          <Link
            href={`/thread/${thread.slug}`}
            className="group block focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
          >
            <h3 className="font-display font-light text-4xl md:text-5xl text-foreground group-hover:text-accent transition-colors leading-[1.05]">
              {thread.title}
            </h3>
            {thread.blurb && (
              <p className="mt-4 font-display italic text-xl leading-relaxed text-muted-foreground max-w-2xl">
                {thread.blurb}
              </p>
            )}
            <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {thread.entries.length} stops  ·  begin →
            </div>
          </Link>
        </section>
      )}

      {featured.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 pb-28">
          <div className="flex items-baseline justify-between mb-12 border-b border-border pb-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              Featured
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {regionCount} regions · {eraCount} eras
            </span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-14 gap-y-12">
            {featured.map((e) => (
              <li key={e.qid}>
                <Link href={`/entity/${e.slug}`} className="group block">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
                    {e.primaryTag ? regionLabel(e.primaryTag) : e.type}
                    {e.dateStart != null
                      ? `  ·  ${fmtYear(e.dateStart)}`
                      : ""}
                  </div>
                  <h3 className="font-display font-light text-3xl md:text-4xl text-foreground group-hover:text-accent transition-colors leading-[1.05] mb-4">
                    {e.name}
                  </h3>
                  {e.summary && (
                    <p className="text-base leading-relaxed text-muted-foreground line-clamp-3">
                      {e.summary.slice(0, 220)}
                      {e.summary.length > 220 ? "…" : ""}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasContent && (
        <section className="max-w-3xl mx-auto px-6 pb-32">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6 border-b border-border pb-3">
            Browse all
          </h2>
          <ul className="divide-y divide-border/60">
            {allEntities.map((e) => (
              <li
                key={e.slug}
                className="py-4 flex items-baseline justify-between gap-6"
              >
                <Link
                  href={`/entity/${e.slug}`}
                  className="font-display text-xl text-foreground hover:text-accent transition-colors flex-1 truncate"
                >
                  {e.name}
                </Link>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground whitespace-nowrap">
                  {e.type}
                  {e.dateStart != null ? `  ·  ${fmtYear(e.dateStart)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
