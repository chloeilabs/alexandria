import Link from "next/link";

import { Container } from "@/components/layout/Container";
import { FeaturedRow } from "@/components/featured/FeaturedRow";
import { getTodaysFeatured } from "@/lib/db/queries/featured";
import { entitiesByIds } from "@/lib/db/queries/entity";
import { getQualitySummary } from "@/lib/db/queries/quality";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [featured, summary] = await Promise.all([
    getTodaysFeatured(),
    getQualitySummary(),
  ]);

  // featured is already EntityStub[] in lib/db/queries/featured; but we
  // pass it through entitiesByIds-style filter to keep it minimal.
  const featuredStubs =
    featured.length > 0 ? featured : await entitiesByIds([]);

  return (
    <main className="py-16">
      <Container>
        <section className="mb-16 max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent mb-4">
            ¶ The Library
          </p>
          <h1
            className="font-display italic"
            style={{
              fontSize: 64,
              letterSpacing: "-0.02em",
              lineHeight: 1.02,
            }}
          >
            An AI-distilled knowledge base.
          </h1>
          <p
            className="font-display italic mt-6"
            style={{
              fontSize: 21,
              lineHeight: 1.6,
              color: "var(--color-muted-foreground)",
              maxWidth: 640,
            }}
          >
            Designed for AI tool calling; readable by humans. Every entry
            is synthesized by a model from its own training, then
            cross-checked for consensus.{" "}
            <Link
              href="/about"
              className="text-accent underline decoration-dotted underline-offset-4"
            >
              How it works.
            </Link>
          </p>

          <div className="mt-8 flex items-baseline gap-8 flex-wrap">
            <Link
              href="/search"
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors border-b border-accent hover:border-foreground pb-1"
            >
              Search the catalogue
            </Link>
            <Link
              href="/browse"
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-accent transition-colors"
            >
              Browse by type
            </Link>
            <code
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
              title="MCP endpoint"
            >
              MCP: /api/mcp
            </code>
          </div>
        </section>

        <section className="mb-16">
          <header className="flex items-baseline justify-between mb-6 flex-wrap gap-y-2">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
              ¶ Today&apos;s featured
            </h2>
            <Link
              href="/browse"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-accent transition-colors"
            >
              Browse all →
            </Link>
          </header>
          <FeaturedRow entities={featuredStubs} />
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Stat label="Published" value={summary.totalPublished} />
          <Stat
            label="Avg consensus"
            value={summary.avgConsensusScore.toFixed(2)}
          />
          <Stat label="Flagged" value={summary.totalFlagged} />
          <Stat label="In review" value={summary.totalReviewQueueOpen} />
        </section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          See the full{" "}
          <Link
            href="/quality"
            className="text-accent hover:text-foreground transition-colors"
          >
            quality dashboard →
          </Link>
        </p>
      </Container>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p
        className="font-display italic mt-1"
        style={{ fontSize: 26, letterSpacing: "-0.01em" }}
      >
        {value}
      </p>
    </div>
  );
}
