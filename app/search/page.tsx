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
import { SearchAutocomplete } from "@/components/search/SearchAutocomplete";
import {
  EditorialPageHeader,
  MonoLabel,
  Display,
} from "@/components/scriptorium/primitives";

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
    <main className="min-h-screen pb-32 codex-paper">
      <div className="max-w-4xl mx-auto px-6 pt-16 pb-10">
        <EditorialPageHeader
          kicker="Quaerere · search"
          title={query ? `“${query}”` : "Search the corpus."}
          titleSize={query ? 56 : 72}
          blurb={
            query
              ? undefined
              : "A query goes through full-text and vector indexes both, then is reranked by relevance. Try a phrase, a name, or a theme."
          }
          divider={!query}
        />
      </div>

      <div className="max-w-3xl mx-auto px-6">
        <form action="/search" method="get" className="mb-8">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <SearchAutocomplete initialQuery={query} />
          {filters.type && (
            <input type="hidden" name="type" value={filters.type} />
          )}
          {filters.era && <input type="hidden" name="era" value={filters.era} />}
        </form>

        {query && (
          <div className="mb-10 space-y-3">
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
          <div
            className="text-center py-16 px-6"
            style={{
              border: "1px solid var(--color-border)",
              background: "var(--color-background-elevated)",
            }}
          >
            <MonoLabel
              tone="accent"
              size={11}
              track="0.32em"
              className="block mb-3"
            >
              ¶ Nihil inventum est
            </MonoLabel>
            <Display size={36} italic style={{ lineHeight: 1.04 }}>
              No matches for &ldquo;{query}&rdquo;.
            </Display>
            <p
              className="font-display italic mx-auto mt-4"
              style={{
                fontSize: 16,
                color: "var(--color-muted-foreground)",
                maxWidth: 480,
              }}
            >
              {filtersActive
                ? "Try clearing the filters, or rephrase the query."
                : "Try a related word or a broader theme — the Library is still growing."}
            </p>
          </div>
        )}

        {!query && (
          <div className="space-y-16 mt-8">
            <div>
              <MonoLabel
                tone="accent"
                size={11}
                track="0.32em"
                className="block mb-4"
              >
                ¶ Try
              </MonoLabel>
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {SAMPLE_QUERIES.map((s) => (
                  <li key={s}>
                    <Link
                      href={`/search?q=${encodeURIComponent(s)}`}
                      className="font-display italic hover:text-accent transition-colors focus:outline-none focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4"
                      style={{
                        fontSize: 22,
                        color: "var(--color-muted-foreground)",
                      }}
                    >
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {suggestions.length > 0 && (
              <div>
                <MonoLabel
                  tone="accent"
                  size={11}
                  track="0.32em"
                  className="block mb-6 pt-6"
                  style={{ borderTop: "1px solid var(--color-border)" }}
                >
                  ¶ Or wander
                </MonoLabel>
                <ul className="space-y-4">
                  {suggestions.map((s) => (
                    <li key={s.qid}>
                      <Link
                        href={`/entity/${s.slug}`}
                        className="group flex items-baseline gap-4 flex-wrap no-underline focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                      >
                        <Display
                          size={22}
                          weight={400}
                          as="span"
                          className="group-hover:text-accent transition-colors"
                          style={{
                            letterSpacing: "-0.008em",
                            lineHeight: 1.1,
                          }}
                        >
                          {s.name}
                        </Display>
                        <MonoLabel size={10} track="0.18em" tone="muted">
                          {s.primaryTag
                            ? regionLabel(s.primaryTag)
                            : s.type}
                          {s.dateStart != null
                            ? `  ·  ${fmtYear(s.dateStart)}`
                            : ""}
                        </MonoLabel>
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
            <MonoLabel
              tone="accent"
              size={11}
              track="0.32em"
              className="block mb-8"
            >
              ¶ {hits.length} result{hits.length === 1 ? "" : "s"}
            </MonoLabel>
            <ul
              className="divide-y"
              style={{ borderColor: "var(--color-border)" }}
            >
              {hits.map((h) => (
                <li
                  key={h.qid}
                  style={{
                    padding: "22px 0",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <Link
                    href={`/entity/${h.slug}`}
                    className="block group no-underline focus:outline-none focus-visible:outline-1 focus-visible:outline-accent focus-visible:outline-offset-4"
                    prefetch={false}
                  >
                    <div className="flex items-baseline gap-4 flex-wrap mb-2">
                      <Display
                        size={28}
                        weight={400}
                        as="h3"
                        className="group-hover:text-accent transition-colors"
                        style={{ letterSpacing: "-0.012em", lineHeight: 1 }}
                      >
                        {h.name}
                      </Display>
                      <MonoLabel size={10} track="0.18em" tone="muted">
                        {h.type}
                        {h.dateStart != null
                          ? `  ·  ${fmtYear(h.dateStart, h.dateStartPrecision)}`
                          : ""}
                      </MonoLabel>
                    </div>
                    {h.snippet && (
                      <p
                        className="font-display search-snippet"
                        style={{
                          fontSize: 16,
                          lineHeight: 1.6,
                          color: "var(--color-muted-foreground)",
                        }}
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
      </div>
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
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent min-w-[3rem]">
        ¶ {label}
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
