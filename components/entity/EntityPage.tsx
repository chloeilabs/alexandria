// The single React tree that renders an entity at any tier.
//
// Tier-conditional structure:
//   T0  — stub message, just name + dates + connections
//   T1  — summary as primary, drop-capped first paragraph
//   T2+ — narrative as primary, drop-capped first paragraph; summary is
//         demoted to a brief epigraph above the narrative
//
// Visual rules (per DECISIONS.md): deep ink background, Cormorant Garamond
// display headlines, aggressive whitespace, no card grids, no drop shadows,
// no bouncy motion.

import Link from "next/link";

import type { EntityPageData } from "@/lib/db/queries/entity";
import { fmtDateRange, fmtYear, regionLabel } from "@/lib/format";
import { labelFor } from "@/lib/wikidata/predicates";

const TYPE_LABEL: Record<string, string> = {
  person: "Person",
  place: "Place",
  event: "Event",
  organization: "Organization",
  work: "Work",
  concept: "Concept",
};

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

interface ProseProps {
  paragraphs: string[];
  className?: string;
}

function Prose({ paragraphs, className = "" }: ProseProps) {
  return (
    <div className={`space-y-7 ${className}`}>
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className={
            i === 0
              ? "text-lg leading-[1.85] text-foreground first-letter:font-display first-letter:font-normal first-letter:text-7xl first-letter:float-left first-letter:mr-3 first-letter:mt-2 first-letter:leading-[0.85] first-letter:text-accent"
              : "text-lg leading-[1.85] text-foreground"
          }
        >
          {p}
        </p>
      ))}
    </div>
  );
}

export function EntityPage({ data }: { data: EntityPageData }) {
  const { entity, aliases, related, orphanTargets, sources } = data;

  const dateRange = fmtDateRange(
    entity.dateStart,
    entity.dateStartPrecision,
    entity.dateEnd,
    entity.dateEndPrecision,
  );

  const primaryText =
    entity.tier >= 2 && entity.narrative
      ? splitParagraphs(entity.narrative)
      : entity.tier >= 1 && entity.summary
        ? splitParagraphs(entity.summary)
        : null;

  return (
    <article className="min-h-screen pb-32">
      {/* Header */}
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6">
          {TYPE_LABEL[entity.type] ?? entity.type}
          {dateRange ? `  ·  ${dateRange}` : ""}
        </div>
        <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.02] tracking-tight text-foreground">
          {entity.name}
        </h1>
        {aliases.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-1 font-display italic text-lg text-muted-foreground">
            {aliases.slice(0, 6).map((a) => (
              <li key={`${a.alias}-${a.language}`}>{a.alias}</li>
            ))}
          </ul>
        )}
      </header>

      {/* Stub state */}
      {entity.tier === 0 && (
        <section className="max-w-3xl mx-auto px-6 py-12">
          <div className="border-l-2 border-accent pl-6 py-2">
            <p className="font-display italic text-xl text-muted-foreground leading-relaxed">
              This entry is a stub. The Library is awakening — a longer
              account is being written.
            </p>
          </div>
        </section>
      )}

      {/* Tier 2+: brief epigraph (the Tier 1 summary, used as TL;DR) */}
      {entity.tier >= 2 && entity.narrative && entity.summary && (
        <section className="max-w-3xl mx-auto px-6 pb-10">
          <p className="font-display italic text-xl leading-relaxed text-muted-foreground border-l-2 border-accent/40 pl-5">
            {entity.summary.slice(0, 260)}
            {entity.summary.length > 260 ? "…" : ""}
          </p>
        </section>
      )}

      {/* Primary prose: narrative if T2+, else summary if T1 */}
      {primaryText && (
        <section className="max-w-3xl mx-auto px-6 py-4">
          <Prose paragraphs={primaryText} />
        </section>
      )}

      {/* Connections */}
      {related.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 pt-20 pb-2">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-8 border-t border-border pt-8">
            Connected to
          </h2>
          <ul className="space-y-4">
            {related.map((r, i) => {
              const lbl = labelFor(r.predicate, r.direction);
              return (
                <li
                  key={`${r.entity.qid}-${r.predicate}-${r.direction}-${i}`}
                  className="grid grid-cols-[12rem_1fr] gap-4 items-baseline"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {lbl}
                  </span>
                  <Link
                    href={`/entity/${r.entity.slug}`}
                    className="font-display text-xl text-foreground hover:text-accent transition-colors group flex items-baseline gap-3 flex-wrap"
                  >
                    <span className="group-hover:underline underline-offset-4 decoration-1">
                      {r.entity.name}
                    </span>
                    {r.entity.dateStart != null && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {fmtYear(r.entity.dateStart, r.entity.dateStartPrecision)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          {orphanTargets.length > 0 && (
            <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
              + {orphanTargets.length} further connection
              {orphanTargets.length === 1 ? "" : "s"} to entries not yet
              ingested
            </p>
          )}
        </section>
      )}

      {/* Source attribution */}
      {sources.length > 0 && (
        <footer className="max-w-3xl mx-auto px-6 pt-20 mt-8">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-4 border-t border-border pt-8">
            Sources
          </h2>
          <ul className="space-y-2 font-mono text-[11px] text-muted-foreground">
            {sources.map((s) => (
              <li key={s.id} className="flex items-baseline gap-3 flex-wrap">
                <span>{sourceLabel(s.sourceKind)}</span>
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent/70 hover:text-accent transition-colors underline decoration-dotted underline-offset-2"
                  >
                    view source
                  </a>
                )}
                {s.license && (
                  <span className="text-muted-foreground/60">{s.license}</span>
                )}
              </li>
            ))}
          </ul>
        </footer>
      )}

      {/* Civilizational context tag — only shown if related entity has them */}
      {related.length > 0 && related[0]?.entity.qid && (
        <p className="sr-only">
          {regionLabel(related[0].entity.type)} context
        </p>
      )}
    </article>
  );
}

function sourceLabel(kind: string): string {
  switch (kind) {
    case "wikipedia":
      return "Adapted from Wikipedia";
    case "britannica_1911":
      return "Encyclopædia Britannica, 1911 edition";
    case "sep":
      return "Stanford Encyclopedia of Philosophy";
    default:
      return kind;
  }
}
