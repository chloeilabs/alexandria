import Link from "next/link";
import {
  getAllEntitySlugs,
  getFeaturedEntities,
} from "@/lib/db/queries/entity";

function fmtYear(year: number | null): string {
  if (year == null) return "";
  return year < 0 ? `${-year} BCE` : `${year} CE`;
}

export default async function Home() {
  const [featured, allEntities] = await Promise.all([
    getFeaturedEntities(12, 2),
    getAllEntitySlugs(200),
  ]);
  const hasContent = allEntities.length > 0;

  // Distinct regions + eras in the featured set (for the masthead chip)
  const regionCount = new Set(
    featured.map((f) => f.primaryTag).filter((t): t is string => t != null),
  ).size;
  const eraCount = new Set(featured.map((f) => f.era)).size;

  return (
    <main className="min-h-screen">
      <section className="max-w-3xl mx-auto px-6 pt-32 pb-16">
        <h1 className="font-display font-light text-6xl md:text-7xl leading-none tracking-tight text-foreground">
          The Library of Alexandria
        </h1>
        <p className="mt-6 font-display italic text-2xl text-muted-foreground max-w-xl">
          A living digital encyclopedia of human civilization. Begin anywhere;
          follow the threads.
        </p>
        <div className="mt-10 flex items-baseline gap-6 flex-wrap">
          <Link
            href="/search"
            className="font-mono text-xs uppercase tracking-[0.2em] text-accent hover:text-foreground transition-colors"
          >
            Search →
          </Link>
          <Link
            href="/timeline"
            className="font-mono text-xs uppercase tracking-[0.2em] text-accent hover:text-foreground transition-colors"
          >
            Timeline →
          </Link>
          <Link
            href="/graph"
            className="font-mono text-xs uppercase tracking-[0.2em] text-accent hover:text-foreground transition-colors"
          >
            Graph →
          </Link>
          <Link
            href="/map"
            className="font-mono text-xs uppercase tracking-[0.2em] text-accent hover:text-foreground transition-colors"
          >
            Map →
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {hasContent
              ? `${allEntities.length} entries`
              : "Awaiting the seed"}
          </span>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <div className="flex items-baseline justify-between mb-10 border-b border-border pb-3">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              Featured
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {regionCount} regions · {eraCount} eras
            </span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
            {featured.map((e) => (
              <li key={e.qid}>
                <Link href={`/entity/${e.slug}`} className="group block">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                    {e.primaryTag?.replace(/-/g, " ") ?? e.type}
                    {e.dateStart != null
                      ? `  ·  ${fmtYear(e.dateStart)}`
                      : ""}
                  </div>
                  <h3 className="font-display text-2xl md:text-3xl text-foreground group-hover:text-accent transition-colors leading-tight mb-3">
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
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-6 border-b border-border pb-3">
            Browse all
          </h2>
          <ul className="divide-y divide-border">
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
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {e.type}
                  {e.dateStart != null
                    ? `  ·  ${fmtYear(e.dateStart)}`
                    : ""}
                  {e.tier >= 1 ? `  ·  T${e.tier}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
