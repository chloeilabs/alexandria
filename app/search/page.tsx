import Link from "next/link";
import { searchByText } from "@/lib/search";
import { getFeaturedEntities } from "@/lib/db/queries/entity";
import { fmtYear, regionLabel } from "@/lib/format";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

const SAMPLE_QUERIES = [
  "empire",
  "fall of an empire",
  "pilgrimage",
  "gold",
  "philosophy",
];

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = q ?? "";
  const [hits, suggestions] = await Promise.all([
    query ? searchByText(query, 30) : Promise.resolve([]),
    query ? Promise.resolve([]) : getFeaturedEntities(6, 1),
  ]);

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 pt-16 pb-24">
      <form action="/search" method="get" className="mb-16">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder="Search the Library…"
          autoFocus
          autoComplete="off"
          spellCheck="false"
          className="w-full bg-transparent border-b border-border px-0 py-4 text-3xl md:text-4xl font-display font-light focus:outline-none focus:border-accent text-foreground placeholder:text-muted-foreground/60 transition-colors"
        />
      </form>

      {query && hits.length === 0 && (
        <p className="font-display italic text-xl text-muted-foreground">
          No matches for &ldquo;{query}&rdquo;.
        </p>
      )}

      {/* Empty state: suggest queries + featured entries */}
      {!query && (
        <div className="space-y-16">
          <div>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-4">
              Try
            </h2>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 font-display italic text-xl text-muted-foreground">
              {SAMPLE_QUERIES.map((s) => (
                <li key={s}>
                  <Link
                    href={`/search?q=${encodeURIComponent(s)}`}
                    className="hover:text-accent transition-colors focus:outline-none focus-visible:text-accent"
                  >
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {suggestions.length > 0 && (
            <div>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6 border-t border-border pt-6">
                Or wander
              </h2>
              <ul className="space-y-4">
                {suggestions.map((s) => (
                  <li key={s.qid}>
                    <Link
                      href={`/entity/${s.slug}`}
                      className="group flex items-baseline gap-4 flex-wrap focus:outline-none"
                    >
                      <span className="font-display text-xl text-foreground group-hover:text-accent group-focus-visible:text-accent transition-colors">
                        {s.name}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {s.primaryTag
                          ? regionLabel(s.primaryTag)
                          : s.type}
                        {s.dateStart != null ? `  ·  ${fmtYear(s.dateStart)}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {hits.length > 0 && (
        <>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-8">
            {hits.length} result{hits.length === 1 ? "" : "s"}
          </h2>
          <ul className="divide-y divide-border/60">
            {hits.map((h) => (
              <li key={h.qid} className="py-7">
                <Link
                  href={`/entity/${h.slug}`}
                  className="block group focus:outline-none"
                >
                  <div className="flex items-baseline gap-4 flex-wrap mb-2">
                    <h3 className="font-display text-2xl md:text-3xl text-foreground group-hover:text-accent group-focus-visible:text-accent transition-colors">
                      {h.name}
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {h.type}
                      {h.dateStart != null
                        ? `  ·  ${fmtYear(h.dateStart, h.dateStartPrecision)}`
                        : ""}
                    </span>
                  </div>
                  {h.summary && (
                    <p className="text-base leading-relaxed text-muted-foreground line-clamp-2">
                      {h.summary.slice(0, 260)}
                      {h.summary.length > 260 ? "…" : ""}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
