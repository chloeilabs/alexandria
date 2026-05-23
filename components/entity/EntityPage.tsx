// The single React tree that renders an entity at any tier.

import Image from "next/image";
import Link from "next/link";

import type {
  EntityPageData,
  RelatedEntity,
} from "@/lib/db/queries/entity";
import {
  fmtDateRange,
  fmtYear,
  firstSentence,
  regionLabel,
} from "@/lib/format";
import { renderInline } from "@/lib/markdown";
import { labelFor } from "@/lib/wikidata/predicates";
import { ERAS } from "@/lib/search";

/** Map a date_start year to its era id. Returns null for undated. */
function eraIdFor(year: number | null | undefined): string | null {
  if (year == null) return null;
  const era = ERAS.find((e) => year >= e.min && year < e.max);
  return era?.id ?? null;
}

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

/**
 * Group related entries by target so the same entity doesn't appear
 * three times for different predicates (e.g., Hannibal → Carthage
 * showing as CITIZEN OF and BORN IN simultaneously).
 */
interface GroupedRelation {
  entity: RelatedEntity["entity"];
  labels: string[];
}

function groupRelated(related: RelatedEntity[]): GroupedRelation[] {
  const byQid = new Map<string, GroupedRelation>();
  for (const r of related) {
    const lbl = labelFor(r.predicate, r.direction);
    const existing = byQid.get(r.entity.qid);
    if (existing) {
      if (!existing.labels.includes(lbl)) existing.labels.push(lbl);
    } else {
      byQid.set(r.entity.qid, { entity: r.entity, labels: [lbl] });
    }
  }
  return [...byQid.values()];
}

interface ProseProps {
  paragraphs: string[];
}

function Prose({ paragraphs }: ProseProps) {
  return (
    <div className="space-y-7">
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className={
            i === 0
              ? "text-lg leading-[1.85] text-foreground first-letter:font-display first-letter:font-normal first-letter:text-7xl first-letter:float-left first-letter:mr-3 first-letter:mt-2 first-letter:leading-[0.85] first-letter:text-accent"
              : "text-lg leading-[1.85] text-foreground"
          }
        >
          {renderInline(p)}
        </p>
      ))}
    </div>
  );
}

export function EntityPage({ data }: { data: EntityPageData }) {
  const {
    entity,
    aliases,
    related,
    orphanTargets,
    sources,
    media,
    regionPeers,
    primaryTag,
    similar,
    factCheck,
  } = data;

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

  const epigraph =
    entity.tier >= 2 && entity.narrative && entity.summary
      ? firstSentence(entity.summary, 280)
      : null;

  const hero = media[0];
  const hasConnections = related.length > 0 || orphanTargets.length > 0;
  const groupedRelated = groupRelated(related);

  return (
    <article className="min-h-screen pb-32">
      {/* Header */}
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6">
          {TYPE_LABEL[entity.type] ?? entity.type}
          {dateRange && eraIdFor(entity.dateStart) ? (
            <>
              {"  ·  "}
              <Link
                href={`/era/${eraIdFor(entity.dateStart)}`}
                className="hover:text-foreground transition-colors focus:outline-none focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-4"
              >
                {dateRange}
              </Link>
            </>
          ) : dateRange ? (
            `  ·  ${dateRange}`
          ) : (
            ""
          )}
          {primaryTag && (
            <>
              {"  ·  "}
              <Link
                href={`/civilization/${primaryTag}`}
                className="hover:text-foreground transition-colors focus:outline-none focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-4"
              >
                {regionLabel(primaryTag)}
              </Link>
            </>
          )}
        </div>
        <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.02] tracking-tight text-foreground">
          {entity.name}
        </h1>
        {aliases.length > 0 && (
          <div className="mt-8 grid grid-cols-[7rem_1fr] gap-x-6 gap-y-1 items-baseline">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
              Also known as
            </span>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 font-display italic text-lg text-muted-foreground">
              {aliases.slice(0, 6).map((a) => (
                <li key={`${a.alias}-${a.language}`}>{a.alias}</li>
              ))}
            </ul>
          </div>
        )}
      </header>

      {/* Hero imagery — period art / photograph if Commons has one. */}
      {hero && (
        <figure className="max-w-4xl mx-auto px-6 pb-12">
          <div className="relative w-full aspect-[16/9] overflow-hidden bg-card">
            <Image
              src={hero.url}
              alt={`Image illustrating ${entity.name}`}
              fill
              sizes="(max-width: 768px) 100vw, 900px"
              className="object-cover"
              priority
            />
          </div>
          <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
            {hero.attribution}
          </figcaption>
        </figure>
      )}

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

      {/* Tier 2: brief epigraph. */}
      {epigraph && (
        <section className="max-w-3xl mx-auto px-6 pb-10">
          <p className="font-display italic text-xl leading-relaxed text-muted-foreground border-l-2 border-accent/40 pl-5">
            {renderInline(epigraph)}
          </p>
        </section>
      )}

      {/* Primary prose. */}
      {primaryText && (
        <section className="max-w-3xl mx-auto px-6 py-4">
          <Prose paragraphs={primaryText} />
        </section>
      )}

      {/* Connections (deduped by target). */}
      {hasConnections && (
        <section className="max-w-3xl mx-auto px-6 pt-20 pb-2">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-8 border-t border-border pt-8">
            Connected to
          </h2>
          {groupedRelated.length > 0 ? (
            <ul className="space-y-4">
              {groupedRelated.map((r) => (
                <li
                  key={r.entity.qid}
                  className="grid grid-cols-[12rem_1fr] gap-4 items-baseline"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {r.labels.join(" · ")}
                  </span>
                  <Link
                    href={`/entity/${r.entity.slug}`}
                    className="font-display text-xl text-foreground hover:text-accent transition-colors group flex items-baseline gap-3 flex-wrap focus:outline-none focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4"
                  >
                    <span className="group-hover:underline underline-offset-4 decoration-1">
                      {r.entity.name}
                    </span>
                    {r.entity.dateStart != null && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {fmtYear(
                          r.entity.dateStart,
                          r.entity.dateStartPrecision,
                        )}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-display italic text-muted-foreground text-lg leading-relaxed">
              {orphanTargets.length} link{orphanTargets.length === 1 ? "" : "s"}
              {" to entries not yet ingested in the Library."}
            </p>
          )}
          {groupedRelated.length > 0 && orphanTargets.length > 0 && (
            <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
              + {orphanTargets.length} further connection
              {orphanTargets.length === 1 ? "" : "s"} to entries not yet
              ingested
            </p>
          )}
        </section>
      )}

      {/* More from this region. */}
      {regionPeers.length > 0 && primaryTag && (
        <section className="max-w-3xl mx-auto px-6 pt-16">
          <div className="flex items-baseline justify-between flex-wrap gap-x-6 gap-y-2 mb-8 border-t border-border pt-8">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              More from {regionLabel(primaryTag)}
            </h2>
            <Link
              href={`/civilization/${primaryTag}`}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-accent transition-colors focus:outline-none focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4"
            >
              browse all →
            </Link>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {regionPeers.map((p) => (
              <li key={p.qid}>
                <Link
                  href={`/entity/${p.slug}`}
                  className="group flex items-baseline gap-3 flex-wrap focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                >
                  <span className="font-display text-lg text-foreground group-hover:text-accent group-focus-visible:text-accent transition-colors">
                    {p.name}
                  </span>
                  {p.dateStart != null && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {fmtYear(p.dateStart, p.dateStartPrecision)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Resonant entries — embedding cosine neighbours. */}
      {similar.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 pt-16">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-8 border-t border-border pt-8">
            Adjacent in spirit
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {similar.map((s) => (
              <li key={s.qid}>
                <Link
                  href={`/entity/${s.slug}`}
                  className="group flex items-baseline gap-3 flex-wrap focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                >
                  <span className="font-display text-lg text-foreground group-hover:text-accent group-focus-visible:text-accent transition-colors">
                    {s.name}
                  </span>
                  {s.dateStart != null && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {fmtYear(s.dateStart, s.dateStartPrecision)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <footer className="max-w-3xl mx-auto px-6 pt-16 mt-8">
          <div className="flex items-baseline justify-between flex-wrap gap-x-6 gap-y-2 mb-4 border-t border-border pt-8">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              Sources
            </h2>
            {factCheck && (
              <span
                className={
                  "font-mono text-[10px] uppercase tracking-[0.18em] " +
                  (factCheck.status === "clean"
                    ? "text-muted-foreground/80"
                    : "text-amber-500/80")
                }
                title={
                  factCheck.status === "clean"
                    ? "Fact-checked against the listed sources: no flagged claims."
                    : `Fact-check flagged ${factCheck.flaggedClaims.length} claim${factCheck.flaggedClaims.length === 1 ? "" : "s"} the listed sources don't fully support.`
                }
              >
                {factCheck.status === "clean"
                  ? "✓ Fact-checked"
                  : `⚠ ${factCheck.flaggedClaims.length} claim${factCheck.flaggedClaims.length === 1 ? "" : "s"} flagged`}
              </span>
            )}
          </div>
          <ul className="space-y-2 font-mono text-[11px] text-muted-foreground">
            {sources.map((s) => (
              <li key={s.id} className="flex items-baseline gap-3 flex-wrap">
                <span>{sourceLabel(s.sourceKind)}</span>
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent/70 hover:text-accent transition-colors underline decoration-dotted underline-offset-2 focus:outline-none focus-visible:text-accent"
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
          {factCheck && factCheck.flaggedClaims.length > 0 && (
            <details className="mt-6 group">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-accent transition-colors">
                Show flagged claims ({factCheck.flaggedClaims.length})
              </summary>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                {factCheck.flaggedClaims.map((f, i) => (
                  <li key={i} className="border-l-2 border-amber-500/40 pl-4">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-500/80 mb-1">
                      {f.reason}
                    </div>
                    <div className="font-display italic">&ldquo;{f.claim}&rdquo;</div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </footer>
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
