import Link from "next/link";

import {
  ENTITY_TYPES,
  ERAS,
  type EraId,
  type EntityTypeFilter,
  type SearchFilters,
  search,
} from "@/lib/search";
import { getFeaturedEntities } from "@/lib/db/queries/entity";
import { fmtYear, regionLabel } from "@/lib/format";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    era?: string;
  }>;
}

const SAMPLE_QUERIES = [
  "empire",
  "fall of an empire",
  "pilgrimage",
  "gold",
  "philosophy",
];

function parseFilters(params: { type?: string; era?: string }): SearchFilters {
  const type = ENTITY_TYPES.find((t) => t === params.type) as
    | EntityTypeFilter
    | undefined;
  const era = ERAS.find((e) => e.id === params.era)?.id as EraId | undefined;
  return { type, era };
}

function filterHref(
  base: { q: string },
  patch: { type?: string | null; era?: string | null },
  current: SearchFilters,
): string {
  const params = new URLSearchParams({ q: base.q });
  const nextType =
    patch.type === null ? undefined : patch.type ?? current.type;
  const nextEra = patch.era === null ? undefined : patch.era ?? current.era;
  if (nextType) params.set("type", nextType);
  if (nextEra) params.set("era", nextEra);
  return `/search?${params.toString()}`;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q ?? "";
  const filters = parseFilters(params);
  const filtersActive = filters.type != null || filters.era != null;

  const [hits, suggestions] = await Promise.all([
    query ? search(query, filters, 30) : Promise.resolve([]),
    query ? Promise.resolve([]) : getFeaturedEntities(6, 1),
  ]);

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 pt-16 pb-24">
      <form action="/search" method="get" className="mb-8">
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
        {/* Preserve filter state when the user types */}
        {filters.type && (
          <input type="hidden" name="type" value={filters.type} />
        )}
        {filters.era && <input type="hidden" name="era" value={filters.era} />}
      </form>

      {/* Facet chips — only visible when there's a query */}
      {query && (
        <div className="mb-12 space-y-3">
          <FacetRow
            label="Type"
            current={filters.type}
            options={[
              { id: undefined, label: "All" },
              ...ENTITY_TYPES.map((t) => ({
                id: t as EntityTypeFilter | undefined,
                label: t[0]!.toUpperCase() + t.slice(1),
              })),
            ]}
            href={(id) =>
              filterHref({ q: query }, { type: id ?? null }, filters)
            }
          />
          <FacetRow
            label="Era"
            current={filters.era}
            options={[
              { id: undefined, label: "All" },
              ...ERAS.map((e) => ({
                id: e.id as EraId | undefined,
                label: e.label,
              })),
            ]}
            href={(id) =>
              filterHref({ q: query }, { era: id ?? null }, filters)
            }
          />
        </div>
      )}

      {query && hits.length === 0 && (
        <p className="font-display italic text-xl text-muted-foreground">
          No matches for &ldquo;{query}&rdquo;
          {filtersActive ? " with these filters." : "."}
        </p>
      )}

      {!query && (
        <div className="space-y-16 mt-8">
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
                        {s.dateStart != null
                          ? `  ·  ${fmtYear(s.dateStart)}`
                          : ""}
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
                  {h.snippet && (
                    <p
                      className="text-base leading-relaxed text-muted-foreground search-snippet"
                      // ts_headline emits known-safe <mark> tags around
                      // matched terms; surrounding text is the same plain
                      // prose we generated for the summary.
                      dangerouslySetInnerHTML={{ __html: h.snippet }}
                    />
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

interface Option<T> {
  id: T;
  label: string;
}

function FacetRow<T extends string | undefined>({
  label,
  current,
  options,
  href,
}: {
  label: string;
  current: T;
  options: ReadonlyArray<Option<T>>;
  href: (id: T) => string;
}) {
  return (
    <div className="flex items-baseline gap-4 flex-wrap">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 min-w-[3rem]">
        {label}
      </span>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((o) => {
          const isActive = (current ?? undefined) === o.id;
          return (
            <li key={String(o.id ?? "_all_")}>
              <Link
                href={href(o.id)}
                className={
                  isActive
                    ? "font-mono text-[10px] uppercase tracking-[0.16em] text-accent border-b border-accent pb-0.5"
                    : "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
                }
              >
                {o.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
