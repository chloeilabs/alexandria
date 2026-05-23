import Link from "next/link";
import { searchByText } from "@/lib/search";
import { fmtYear } from "@/lib/format";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = q ?? "";
  const hits = query ? await searchByText(query, 30) : [];

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 pt-16 pb-24">
      <form action="/search" method="get" className="mb-16">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search the Library…"
          autoFocus
          className="w-full bg-transparent border-b border-border px-0 py-4 text-3xl md:text-4xl font-display font-light focus:outline-none focus:border-accent text-foreground placeholder:text-muted-foreground transition-colors"
        />
      </form>

      {query && hits.length === 0 && (
        <p className="font-display italic text-xl text-muted-foreground">
          No matches for &ldquo;{query}&rdquo;.
        </p>
      )}

      {!query && (
        <p className="font-display italic text-xl text-muted-foreground">
          Try a name, a place, an idea. The Library answers what it knows.
        </p>
      )}

      {hits.length > 0 && (
        <>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-8">
            {hits.length} result{hits.length === 1 ? "" : "s"}
          </h2>
          <ul className="divide-y divide-border/60">
            {hits.map((h) => (
              <li key={h.qid} className="py-7">
                <Link href={`/entity/${h.slug}`} className="block group">
                  <div className="flex items-baseline gap-4 flex-wrap mb-2">
                    <h3 className="font-display text-2xl md:text-3xl text-foreground group-hover:text-accent transition-colors">
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
