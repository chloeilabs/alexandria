import Link from "next/link";
import { ProvenanceBadge } from "@/components/entity/ProvenanceBadge";
import type { EntityStub } from "@/lib/db/queries/entity";

export function SearchResults({ results }: { results: EntityStub[] }) {
  if (!results.length) {
    return (
      <p
        className="font-display italic mt-12 text-center"
        style={{
          fontSize: 18,
          color: "var(--color-muted-foreground)",
        }}
      >
        Nothing matches yet. The corpus is still small.
      </p>
    );
  }

  return (
    <ul className="mt-8 space-y-6">
      {results.map((r) => (
        <li key={r.id}>
          <Link
            href={`/entity/${r.slug}`}
            className="block group focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
          >
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2
                className="font-display italic group-hover:text-accent transition-colors"
                style={{
                  fontSize: 24,
                  letterSpacing: "-0.01em",
                }}
              >
                {r.canonicalName}
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {r.entityType}
              </span>
              <ProvenanceBadge
                consensusScore={r.consensusScore}
                generatorModel=""
                verifierModel={null}
                compact
              />
            </div>
            <p
              className="font-display mt-1"
              style={{
                fontSize: 16,
                color: "var(--color-muted-foreground)",
                lineHeight: 1.55,
              }}
            >
              {r.shortDescription}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
