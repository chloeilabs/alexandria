// The single React tree that renders an entity at any tier (0-3).
// Tier-conditional blocks render extra content as the entity is enriched.
//
// Visual style: deep ink background, Cormorant Garamond display headlines,
// aggressive whitespace, period-art-friendly. NO card grids, NO drop
// shadows, NO bouncy motion. See DECISIONS.md.

import Link from "next/link";
import type { EntityPageData } from "@/lib/db/queries/entity";
import { labelFor } from "@/lib/wikidata/predicates";

function fmtYear(year: number | null, precision: string | null): string {
  if (year == null) return "";
  const era = year < 0 ? "BCE" : "CE";
  const y = Math.abs(year);
  if (precision === "decade") return `${y}s ${era}`;
  if (precision === "century") {
    const c = Math.floor(y / 100) + 1;
    return `${c}${nthSuffix(c)} c. ${era}`;
  }
  if (precision === "millennium") return `${Math.floor(y / 1000)}k ${era}`;
  return `${y} ${era}`;
}

function nthSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0] ?? "th";
}

function fmtDateRange(
  start: number | null,
  startPrec: string | null,
  end: number | null,
  endPrec: string | null,
): string {
  const a = fmtYear(start, startPrec);
  const b = fmtYear(end, endPrec);
  if (!a) return "";
  if (!b) return a;
  return `${a} — ${b}`;
}

const TYPE_LABEL: Record<string, string> = {
  person: "Person",
  place: "Place",
  event: "Event",
  organization: "Organization",
  work: "Work",
  concept: "Concept",
};

export function EntityPage({ data }: { data: EntityPageData }) {
  const { entity, aliases, related, orphanTargets, sources } = data;
  const dateRange = fmtDateRange(
    entity.dateStart,
    entity.dateStartPrecision,
    entity.dateEnd,
    entity.dateEndPrecision,
  );

  return (
    <article className="min-h-screen pb-32">
      {/* Header */}
      <header className="max-w-3xl mx-auto px-6 pt-24 pb-12">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-6">
          {TYPE_LABEL[entity.type] ?? entity.type}
          {dateRange ? `  ·  ${dateRange}` : ""}
        </div>
        <h1 className="font-display font-light text-5xl md:text-6xl leading-[1.05] tracking-tight text-foreground">
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

      {/* Tier 0 — stub message if no summary */}
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

      {/* Tier 1+ — summary */}
      {entity.tier >= 1 && entity.summary && (
        <section className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-lg leading-[1.75] text-foreground first-letter:font-display first-letter:text-5xl first-letter:font-normal first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:leading-none first-letter:text-accent">
            {entity.summary}
          </p>
        </section>
      )}

      {/* Tier 2+ — full narrative */}
      {entity.tier >= 2 && entity.narrative && (
        <section className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {entity.narrative.split(/\n\n+/).map((para, i) => (
            <p key={i} className="text-lg leading-[1.85] text-foreground">
              {para}
            </p>
          ))}
        </section>
      )}

      {/* Connections */}
      {related.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-6">
            Connected to
          </h2>
          <ul className="space-y-3">
            {related.map((r, i) => {
              const lbl = labelFor(r.predicate, r.direction);
              return (
                <li
                  key={`${r.entity.qid}-${r.predicate}-${r.direction}-${i}`}
                  className="flex items-baseline gap-4"
                >
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground min-w-[12rem]">
                    {lbl}
                  </span>
                  <Link
                    href={`/entity/${r.entity.slug}`}
                    className="font-display text-xl text-foreground hover:text-accent transition-colors underline-offset-4 decoration-1 decoration-transparent hover:decoration-accent"
                  >
                    {r.entity.name}
                  </Link>
                  {r.entity.dateStart != null && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {fmtYear(r.entity.dateStart, r.entity.dateStartPrecision)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {orphanTargets.length > 0 && (
            <p className="mt-6 font-mono text-xs text-muted-foreground italic">
              {orphanTargets.length} further connection
              {orphanTargets.length === 1 ? "" : "s"} to entries not yet
              ingested.
            </p>
          )}
        </section>
      )}

      {/* Source attribution */}
      {sources.length > 0 && (
        <footer className="max-w-3xl mx-auto px-6 pt-16 pb-8 border-t border-border">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">
            Sources
          </h2>
          <ul className="space-y-1 font-mono text-xs text-muted-foreground">
            {sources.map((s) => (
              <li key={s.id}>
                {sourceLabel(s.sourceKind)}
                {s.url && (
                  <>
                    {" · "}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline hover:text-accent"
                    >
                      source
                    </a>
                  </>
                )}
                {s.license && <> · {s.license}</>}
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  );
}

function sourceLabel(kind: string): string {
  switch (kind) {
    case "wikipedia":
      return "Wikipedia";
    case "britannica_1911":
      return "Encyclopædia Britannica, 1911 edition";
    case "sep":
      return "Stanford Encyclopedia of Philosophy";
    default:
      return kind;
  }
}
