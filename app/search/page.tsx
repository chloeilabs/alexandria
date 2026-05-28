import type { Metadata } from "next";

import { Container } from "@/components/layout/Container";
import { SearchInput } from "@/components/search/SearchInput";
import { SearchResults } from "@/components/search/SearchResults";
import { hybridSearch } from "@/lib/db/queries/search";
import { ENTITY_TYPES, type EntityType } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search · Alexandria",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  const query = q?.trim() ?? "";
  const entityType =
    type && (ENTITY_TYPES as readonly string[]).includes(type)
      ? (type as EntityType)
      : undefined;

  const results = query
    ? await hybridSearch({ query, entityType, limit: 30 })
    : [];

  return (
    <main className="py-12">
      <Container>
        <header className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
            ¶ Search
          </p>
          <h1
            className="font-display italic"
            style={{
              fontSize: 48,
              letterSpacing: "-0.015em",
              lineHeight: 1.04,
            }}
          >
            The catalogue is open.
          </h1>
          <p
            className="font-display italic mt-3"
            style={{
              fontSize: 17,
              color: "var(--color-muted-foreground)",
            }}
          >
            Hybrid full-text + semantic search across the corpus.
          </p>
        </header>

        <SearchInput initialQuery={query} />

        {query && (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-6">
              {results.length} {results.length === 1 ? "result" : "results"}
            </p>
            <SearchResults results={results} />
          </>
        )}
      </Container>
    </main>
  );
}
