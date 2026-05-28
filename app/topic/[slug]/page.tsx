import { notFound } from "next/navigation";
import Link from "next/link";

import { Container } from "@/components/layout/Container";
import { SearchResults } from "@/components/search/SearchResults";
import { Pagination } from "@/components/browse/Pagination";
import { TopicChip } from "@/components/topic/TopicChip";
import { listByTopic } from "@/lib/db/queries/entity";
import { relatedTopics } from "@/lib/db/queries/topic";

export const dynamic = "force-dynamic";

const PER_PAGE = 30;

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const topic = decodeURIComponent(slug);
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw ?? 1));

  const [results, related] = await Promise.all([
    listByTopic({
      topic,
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
    }),
    relatedTopics(topic),
  ]);

  if (page === 1 && results.length === 0) {
    notFound();
  }

  return (
    <main className="py-12">
      <Container>
        <header className="mb-8">
          <Link
            href="/browse"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-accent transition-colors"
          >
            ← Browse
          </Link>
          <h1
            className="font-display italic mt-3"
            style={{
              fontSize: 48,
              letterSpacing: "-0.015em",
              lineHeight: 1.04,
            }}
          >
            {topic}
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-2">
            topic cluster
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-12">
          <div>
            <SearchResults results={results} />
            <Pagination
              basePath={`/topic/${encodeURIComponent(topic)}`}
              page={page}
              perPage={PER_PAGE}
              count={results.length}
            />
          </div>
          {related.length > 0 && (
            <aside
              className="lg:border-l lg:pl-6"
              style={{ borderColor: "var(--color-border-faint)" }}
            >
              <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
                ¶ Related topics
              </h2>
              <ul className="flex flex-wrap gap-2">
                {related.map((t) => (
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
