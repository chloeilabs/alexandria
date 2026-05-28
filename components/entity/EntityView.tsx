import Link from "next/link";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { ClaimedCitations, type ClaimedCitation } from "./ClaimedCitations";
import { RelatedPanel, type RelatedRow } from "./RelatedPanel";
import type { EntityFull } from "@/lib/db/queries/entity";

export function EntityView({
  entity,
  related,
  citations,
}: {
  entity: EntityFull;
  related: RelatedRow[];
  citations: ClaimedCitation[];
}) {
  const paragraphs = entity.narrative
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <article className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-12">
      <div>
        <header className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-2">
            {entity.entityType}
            {entity.disambiguator ? ` · ${entity.disambiguator}` : ""}
          </p>
          <h1
            className="font-display italic"
            style={{
              fontSize: 56,
              letterSpacing: "-0.015em",
              lineHeight: 1.04,
            }}
          >
            {entity.canonicalName}
          </h1>
          {entity.topics.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {entity.topics.map((t) => (
                <li key={t}>
                  <Link
                    href={`/topic/${encodeURIComponent(t)}`}
                    className="font-mono text-[10px] uppercase tracking-[0.18em] px-2 py-1 border hover:text-accent hover:border-accent transition-colors"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </header>

        <div className="mb-8">
          <ProvenanceBadge
            consensusScore={entity.consensusScore}
            generatorModel={entity.generatorModel}
            verifierModel={entity.verifierModel}
          />
        </div>

        <p
          className="font-display italic mb-8"
          style={{
            fontSize: 22,
            lineHeight: 1.55,
            color: "var(--color-muted-foreground)",
          }}
        >
          {entity.shortDescription}
        </p>

        <p
          className="font-display mb-10"
          style={{
            fontSize: 19,
            lineHeight: 1.7,
            color: "var(--color-foreground)",
          }}
        >
          {entity.summary}
        </p>

        <section className="space-y-6 prose-narrative">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="font-display"
              style={{
                fontSize: 17,
                lineHeight: 1.75,
                color: "var(--color-foreground)",
              }}
            >
              {p}
            </p>
          ))}
        </section>

        {Object.keys(entity.structuredFacts).length > 0 && (
          <section className="mt-12">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
              ¶ Facts
            </h2>
            <dl
              className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-6 gap-y-2 font-display"
              style={{ fontSize: 15 }}
            >
              {Object.entries(entity.structuredFacts).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground self-baseline">
                    {k.replace(/_/g, " ")}
                  </dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {entity.keyDates.length > 0 && (
          <section className="mt-12">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
              ¶ Key dates
            </h2>
            <ol className="space-y-2 font-display" style={{ fontSize: 15 }}>
              {entity.keyDates.map((d, i) => (
                <li key={i} className="flex items-baseline gap-4">
                  <span className="font-mono text-foreground tabular-nums">
                    {d.year}
                  </span>
                  <span className="text-muted-foreground italic">{d.label}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <ClaimedCitations citations={citations} />
      </div>

      <RelatedPanel related={related} />
    </article>
  );
}
