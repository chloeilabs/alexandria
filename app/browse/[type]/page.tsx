import { notFound } from "next/navigation";
import Link from "next/link";

import { Container } from "@/components/layout/Container";
import { SearchResults } from "@/components/search/SearchResults";
import { Pagination } from "@/components/browse/Pagination";
import { TopicChip } from "@/components/topic/TopicChip";
import { listByType } from "@/lib/db/queries/entity";
import { topicsForType } from "@/lib/db/queries/topic";
import { ENTITY_TYPES, type EntityType } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const PER_PAGE = 30;

export default async function BrowseTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { type } = await params;
  if (!(ENTITY_TYPES as readonly string[]).includes(type)) notFound();
  const entityType = type as EntityType;

  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw ?? 1));

  const [results, topTopics] = await Promise.all([
    listByType({
      entityType,
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
    }),
    topicsForType(entityType),
  ]);

  return (
    <main className="py-12">
      <Container>
        <header className="mb-8">
          <Link
            href="/browse"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-accent transition-colors"
          >
            ← All types
          </Link>
          <h1
            className="font-display italic capitalize mt-3"
            style={{
              fontSize: 48,
              letterSpacing: "-0.015em",
              lineHeight: 1.04,
            }}
          >
            {entityType}s
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-12">
          <div>
            <SearchResults results={results} />
            <Pagination
              basePath={`/browse/${entityType}`}
              page={page}
              perPage={PER_PAGE}
              count={results.length}
            />
          </div>
          {topTopics.length > 0 && (
            <aside
              className="lg:border-l lg:pl-6"
              style={{ borderColor: "var(--color-border-faint)" }}
            >
              <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
                ¶ Topics
              </h2>
              <ul className="flex flex-wrap gap-2">
                {topTopics.map((t) => (
                  <li key={t.topic}>
                    <TopicChip topic={t.topic} count={t.count} />
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </Container>
    </main>
  );
}
