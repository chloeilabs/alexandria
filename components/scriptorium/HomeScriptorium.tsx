// HOME · SCRIPTORIUM
// A literary anthology layout: frontispiece → editor's preface → era-
// grouped table of contents → three long-form selected readings →
// engraved civilization compass plate → six continued readings →
// civilization index → colophon.
//
// All sections read from real DB queries. Pure server component.

import Link from "next/link";

import Image from "next/image";

import type { FeaturedEntity } from "@/lib/db/queries/entity";
import type { ScriptoriumStats } from "@/lib/db/queries/scriptorium";
import type { ThreadData } from "@/lib/db/queries/thread";
import { fmtDateRange, fmtYear, regionLabel } from "@/lib/format";

import { Folio, MonoLabel, Display } from "./primitives";
import { PlaceholderPlate, toneFor } from "./PlaceholderPlate";
import { Ornament } from "./Ornament";

type CivCount = {
  slug: string;
  entryCount: number;
};

type ThreadCard = {
  slug: string;
  title: string;
  blurb: string | null;
  entryCount: number;
  featured: boolean;
};

type Props = {
  featured: FeaturedEntity[];
  stats: ScriptoriumStats;
  civs: CivCount[];
  threads: ThreadCard[];
  /** Editorial-pick thread surfaced just after the frontispiece. */
  featuredThread: ThreadData | null;
  /** Total eras with at least one entry — for the frontispiece ledger. */
  erasWithEntries: number;
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
function romanNumeral(n: number): string {
  return ROMAN[n - 1] ?? String(n);
}

// Coarse "European vs not" heuristic used by the foldout plate +
// civilization index to differentiate spoke colour. Matches the
// prototype's editorial commitment without hand-tagging every slug.
const EUROPEAN_HINTS =
  /^(mediterranean|greek|roman|hellen|byzantin|renaissance|enlightenment|carolingian|frankish|holy-roman|norse|viking|anglo|saxon|merovingian|spanish-empire|venetian|florent|tuscan|german|prussia|polish|hungar|baltic|celt|gaul|iberian|portuguese|dutch|french|british|english|italian|european)/i;

function isEuropean(slug: string): boolean {
  return EUROPEAN_HINTS.test(slug);
}

// ── Frontispiece ──────────────────────────────────────────────────

function Frontispiece({ stats }: { stats: ScriptoriumStats }) {
  const ledger: Array<[string, string]> = [
    ["readings", stats.entries.toLocaleString()],
    ["civilizations", String(stats.civilizations)],
    ["eras", String(stats.eras)],
    ["anchors", String(stats.tier3)],
    ["annos", stats.yearsSpanned.toLocaleString()],
  ];
  return (
    <div className="text-center pt-3 pb-5">
      <Ornament style={{ marginBottom: 22 }} />

      <div
        className="font-display italic"
        style={{
          fontSize: 20,
          color: "var(--color-accent)",
          letterSpacing: "0.06em",
          marginBottom: 14,
        }}
      >
        Hic Incipit
      </div>

      <Display
        size={140}
        weight={400}
        style={{ lineHeight: 0.86, letterSpacing: "-0.03em" }}
      >
        Alexandria
      </Display>

      <div
        className="font-display italic mt-3"
        style={{
          fontSize: 26,
          color: "var(--color-foreground)",
        }}
      >
        sive Anthologia Civilizationum Humanarum
      </div>

      <div className="mx-auto" style={{ margin: "32px auto 26px", width: 420 }}>
        <div style={{ height: 1, background: "var(--color-rule)", marginBottom: 4 }} />
        <div style={{ height: 3, background: "var(--color-accent)", marginBottom: 4 }} />
        <div style={{ height: 1, background: "var(--color-rule)" }} />
      </div>

      <p
        className="font-display italic mx-auto"
        style={{
          fontSize: 22,
          lineHeight: 1.6,
          color: "var(--color-foreground)",
          maxWidth: 680,
          marginBottom: 30,
        }}
      >
        Selected readings on what human civilizations have done, in the
        manner of an editor&rsquo;s anthology — every entry attributed,
        every selection deliberate, and arranged so no single tradition
        leads.
      </p>

      <div
        className="grid mx-auto grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
        style={{
          maxWidth: 820,
          border: "1px solid var(--color-rule)",
          background: "var(--color-background-elevated)",
        }}
      >
        {ledger.map(([k, v]) => (
          <div
            key={k}
            className="text-center"
            style={{
              padding: "14px 8px",
              borderRight: `1px solid var(--color-rule)`,
              borderBottom: `1px solid var(--color-rule)`,
            }}
          >
            <div
              className="font-display"
              style={{
                fontSize: 38,
                color: "var(--color-accent)",
                lineHeight: 1,
                letterSpacing: "-0.01em",
                fontWeight: 500,
              }}
            >
              {v}
            </div>
            <div
              className="font-display italic"
              style={{
                fontSize: 13,
                color: "var(--color-muted-foreground)",
                marginTop: 4,
              }}
            >
              {k}
            </div>
          </div>
        ))}
      </div>

      <div
        className="font-display italic"
        style={{
          marginTop: 26,
          fontSize: 16,
          color: "var(--color-muted-foreground)",
        }}
      >
        editum hodie · liber recens compositus
      </div>
    </div>
  );
}

// ── Editor's Preface ─────────────────────────────────────────────

function EditorsPreface({ stats }: { stats: ScriptoriumStats }) {
  const otherEntries = Math.max(0, stats.entries - stats.tier3);
  return (
    <div
      className="grid gap-9 pb-3 grid-cols-1 lg:[grid-template-columns:160px_1fr_240px]"
    >
      <aside>
        <MonoLabel size={10} track="0.28em" tone="accent" className="block mb-2">
          ¶ Praefatio
        </MonoLabel>
        <MonoLabel size={10} track="0.22em" tone="muted" className="block">
          ab editore · ad lectorem
        </MonoLabel>
        <div
          className="mt-5"
          style={{
            padding: "12px 0",
            borderTop: "1px solid var(--color-accent)",
            borderBottom: "1px solid var(--color-accent)",
          }}
        >
          <MonoLabel size={9} track="0.22em" className="block mb-1">
            by
          </MonoLabel>
          <div
            className="font-display italic"
            style={{ fontSize: 15, color: "var(--color-foreground)" }}
          >
            the curator
          </div>
        </div>
      </aside>

      <div style={{ maxWidth: 720 }}>
        <Display
          size={62}
          italic
          weight={400}
          style={{ letterSpacing: "-0.01em", lineHeight: 1.06, marginBottom: 22 }}
        >
          On what this volume is.
        </Display>
        <p
          className="font-display drop-cap"
          style={{
            fontSize: 19,
            lineHeight: 1.65,
            color: "var(--color-foreground)",
            margin: 0,
            textAlign: "justify",
            hyphens: "auto",
          }}
        >
          Most encyclopedias of human civilization default to the West.
          Wikipedia is densest in English; English is densest on European
          subjects; the long tail of non-European history is
          under-represented even where the underlying scholarship is rich.
          This volume resists that default at every layer. The seed
          filter rewards entries with sitelinks in non-European
          Wikipedias. The selection on the front page never lets one
          civilization dominate. Tags are curated, not imposed from a
          map of modern borders.
        </p>
        <p
          className="font-display"
          style={{
            fontSize: 19,
            lineHeight: 1.65,
            color: "var(--color-foreground)",
            margin: "14px 0 0 0",
            textAlign: "justify",
            hyphens: "auto",
            textIndent: "1.6em",
          }}
        >
          <span style={{ color: "var(--color-accent)", marginRight: 6 }}>¶</span>
          The {stats.tier3} <em>anchors</em> are the explicit answer to
          the question, &ldquo;what should an encyclopedia of human
          history look like if you do not begin in Europe?&rdquo; They are
          Hannibal, Mansa Musa, Wu Zetian, Hatshepsut, Songhai, Saladin,
          Murasaki Shikibu, Akbar, Túpac Amaru II, and the Bronze-Age
          Collapse. The remaining {otherEntries.toLocaleString()} entries
          orbit them.
        </p>
        <p
          className="font-display"
          style={{
            fontSize: 19,
            lineHeight: 1.65,
            color: "var(--color-foreground)",
            margin: "14px 0 0 0",
            textAlign: "justify",
            hyphens: "auto",
            textIndent: "1.6em",
          }}
        >
          <span style={{ color: "var(--color-accent)", marginRight: 6 }}>¶</span>
          The reader is welcome to begin anywhere. The threads — curated
          paths through five-to-seven entries — will lead you on.
        </p>
        <div
          className="font-display italic text-right"
          style={{
            marginTop: 22,
            fontSize: 15,
            color: "var(--color-accent)",
          }}
        >
          — the curator, Alexandria
        </div>
      </div>

      <aside
        className="self-start"
        style={{
          padding: "14px 16px",
          background: "var(--color-background)",
          border: "1px solid var(--color-rule)",
        }}
      >
        <MonoLabel size={10} track="0.28em" tone="accent" className="block mb-2.5">
          On this issue
        </MonoLabel>
        <ul
          className="font-display"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            fontSize: 13.5,
            lineHeight: 1.55,
          }}
        >
          {[
            "table of contents (fol. ii.r)",
            "one engraved plate (fol. ii.v)",
            "six readings, in brief (fol. iii.r)",
            "full civilizational index (fol. ult.)",
          ].map((line, i) => (
            <li
              key={i}
              style={{
                padding: "5px 0",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <span style={{ color: "var(--color-muted-foreground)" }}>{line}</span>
            </li>
          ))}
        </ul>
        <div
          className="font-display italic"
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--color-accent)",
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "var(--color-foreground)",
          }}
        >
          Each reading is offered as a long excerpt. Click the title at
          the head of a reading to consult the full chapter.
        </div>
      </aside>
    </div>
  );
}

// ── Featured Thread — the editor's lead pick ─────────────────────

function FeaturedThread({ thread }: { thread: ThreadData }) {
  // Two preview stops, big and rich; the rest in a tidy list.
  const lead = thread.entries.slice(0, 2);
  const rest = thread.entries.slice(2);

  return (
    <div>
      <div className="text-center mb-8">
        <div
          className="font-display italic uppercase"
          style={{
            fontSize: 16,
            color: "var(--color-accent)",
            letterSpacing: "0.32em",
            marginBottom: 4,
          }}
        >
          Lectio hebdomadalis
        </div>
        <Display
          size={64}
          italic
          style={{ lineHeight: 1.02, letterSpacing: "-0.015em" }}
        >
          {thread.title}
        </Display>
        {thread.blurb && (
          <p
            className="font-display italic mx-auto mt-5"
            style={{
              fontSize: 19,
              lineHeight: 1.55,
              color: "var(--color-muted-foreground)",
              maxWidth: 680,
            }}
          >
            {thread.blurb}
          </p>
        )}
        <div className="mt-5">
          <MonoLabel tone="muted" size={10} track="0.22em">
            Itinerarium · {thread.entries.length}{" "}
            {thread.entries.length === 1 ? "stop" : "stops"}
            {thread.featured ? "  ·  featured" : ""}
          </MonoLabel>
        </div>
      </div>

      {thread.intro && (
        <p
          className="font-display mx-auto mb-10"
          style={{
            fontSize: 19,
            lineHeight: 1.65,
            color: "var(--color-foreground)",
            maxWidth: 720,
            textAlign: "justify",
            hyphens: "auto",
          }}
        >
          {thread.intro}
        </p>
      )}

      {lead.length > 0 && (
        <ol
          className="grid gap-10 grid-cols-1 md:grid-cols-2 mb-8"
          style={{ listStyle: "none", padding: 0, margin: "0 0 32px" }}
          start={1}
        >
          {lead.map((e, i) => (
            <li key={e.qid}>
              <Link
                href={`/entity/${e.slug}`}
                className="group block no-underline focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                prefetch={false}
              >
                <div className="flex items-baseline justify-between mb-3">
                  <span
                    className="font-display italic uppercase"
                    style={{
                      fontSize: 12,
                      letterSpacing: "0.22em",
                      color: "var(--color-accent)",
                    }}
                  >
                    Caput {romanNumeral(i + 1)}
                  </span>
                  {e.dateStart != null && (
                    <MonoLabel size={9} track="0.18em" tone="muted">
                      {fmtYear(e.dateStart, e.dateStartPrecision)}
                      {e.dateEnd != null
                        ? ` – ${fmtYear(e.dateEnd, e.dateEndPrecision)}`
                        : ""}
                    </MonoLabel>
                  )}
                </div>
                <div
                  className="relative overflow-hidden mb-4"
                  style={{
                    aspectRatio: "16/10",
                    background: "var(--color-background)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {e.heroUrl ? (
                    <Image
                      src={e.heroUrl}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, 400px"
                      className="object-cover"
                    />
                  ) : (
                    <PlaceholderPlate
                      slug={e.slug}
                      tone={toneFor(e.name)}
                      tier={e.tier}
                      aspectRatio="16/10"
                      showCaption={false}
                    />
                  )}
                </div>
                <Display
                  size={30}
                  weight={400}
                  as="h3"
                  className="group-hover:text-accent transition-colors mb-2"
                  style={{ letterSpacing: "-0.012em", lineHeight: 1.04 }}
                >
                  {e.name}
                </Display>
                {e.note && (
                  <p
                    className="font-display italic"
                    style={{
                      fontSize: 15.5,
                      lineHeight: 1.55,
                      color: "var(--color-muted-foreground)",
                      margin: "0 0 8px",
                    }}
                  >
                    {e.note}
                  </p>
                )}
                {!e.note && e.summary && (
                  <p
                    className="font-display"
                    style={{
                      fontSize: 15.5,
                      lineHeight: 1.55,
                      color: "var(--color-muted-foreground)",
                      margin: "0 0 8px",
                    }}
                  >
                    {firstLine(e.summary, 180)}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}

      {rest.length > 0 && (
        <div
          className="pt-6 mb-10"
          style={{ borderTop: "1px solid var(--color-rule)" }}
        >
          <MonoLabel
            tone="accent"
            size={10}
            track="0.32em"
            className="block mb-4"
          >
            ¶ Then onward
          </MonoLabel>
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
            }}
          >
            {rest.map((e, i) => (
              <li
                key={e.qid}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px dotted var(--color-border)",
                }}
              >
                <Link
                  href={`/entity/${e.slug}`}
                  className="group grid items-baseline gap-3 no-underline focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent grid-cols-[48px_1fr_auto]"
                  prefetch={false}
                >
                  <span
                    className="font-display italic uppercase"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.22em",
                      color: "var(--color-accent)",
                    }}
                  >
                    {romanNumeral(i + 3)}
                  </span>
                  <span
                    className="font-display group-hover:text-accent transition-colors min-w-0"
                    style={{
                      fontSize: 19,
                      color: "var(--color-foreground)",
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {e.name}
                    {e.note && (
                      <span
                        className="font-display italic"
                        style={{
                          fontSize: 15,
                          color: "var(--color-muted-foreground)",
                          marginLeft: 8,
                        }}
                      >
                        — {e.note}
                      </span>
                    )}
                  </span>
                  {e.dateStart != null && (
                    <MonoLabel size={9} track="0.18em" tone="muted">
                      {fmtYear(e.dateStart, e.dateStartPrecision)}
                    </MonoLabel>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="text-center">
        <Link
          href={`/thread/${thread.slug}`}
          className="font-mono uppercase text-accent hover:text-foreground transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
          style={{
            fontSize: 11,
            letterSpacing: "0.32em",
            borderBottom: "1px solid var(--color-accent)",
            paddingBottom: 4,
          }}
        >
          Walk this thread →
        </Link>
      </div>
    </div>
  );
}

// ── Table of Contents ─────────────────────────────────────────────

const ERA_ORDER = ["Ancient", "Classical", "Medieval", "Early Modern", "Modern", "Undated"];

function groupByEra(entries: FeaturedEntity[]) {
  const groups = new Map<string, FeaturedEntity[]>();
  for (const e of entries) {
    const arr = groups.get(e.era) ?? [];
    arr.push(e);
    groups.set(e.era, arr);
  }
  return ERA_ORDER.filter((era) => groups.has(era)).map((era) => ({
    era,
    entries: groups.get(era)!,
  }));
}

function AnthologyToc({
  featured,
  totalEntries,
}: {
  featured: FeaturedEntity[];
  totalEntries: number;
}) {
  const groups = groupByEra(featured);
  return (
    <div>
      <div className="text-center mb-7">
        <div
          className="font-display italic uppercase"
          style={{
            fontSize: 16,
            color: "var(--color-accent)",
            letterSpacing: "0.32em",
            marginBottom: 4,
          }}
        >
          Tabula contentorum
        </div>
        <Display
          size={56}
          italic
          style={{ lineHeight: 1, letterSpacing: "-0.015em" }}
        >
          A reading list, organised by era.
        </Display>
        <p
          className="font-display italic mx-auto"
          style={{
            fontSize: 17,
            color: "var(--color-muted-foreground)",
            marginTop: 12,
            maxWidth: 600,
          }}
        >
          {featured.length} readings drawn from the corpus of {totalEntries.toLocaleString()}.
          Within each era, ordered chronologically.
        </p>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{ gap: "8px 56px" }}
      >
        {groups.map((group) => (
          <div key={group.era}>
            <div
              className="font-display italic uppercase"
              style={{
                fontSize: 18,
                letterSpacing: "0.16em",
                color: "var(--color-accent)",
                padding: "14px 0 6px",
                marginBottom: 6,
                borderBottom: "1px solid var(--color-accent)",
              }}
            >
              ¶ {group.era}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {group.entries.map((e) => (
                <li
                  key={e.slug}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px dotted var(--color-border)",
                  }}
                >
                  <Link
                    href={`/entity/${e.slug}`}
                    className="block no-underline group"
                    prefetch={false}
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <span
                        className="font-display group-hover:text-accent transition-colors"
                        style={{
                          fontWeight: 500,
                          fontSize: 22,
                          color: "var(--color-foreground)",
                          letterSpacing: "-0.008em",
                        }}
                      >
                        {e.name}
                      </span>
                      <MonoLabel size={10} track="0.18em" tone="muted">
                        {fmtDateRange(e.dateStart, "year", e.dateEnd, "year") || "—"}
                      </MonoLabel>
                    </div>
                    <p
                      className="font-display italic"
                      style={{
                        fontSize: 14.5,
                        lineHeight: 1.5,
                        color: "var(--color-muted-foreground)",
                        margin: 0,
                      }}
                    >
                      {firstLine(e.summary) || `${e.type} · ${e.era}`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function firstLine(summary: string | null | undefined, max = 180): string {
  if (!summary) return "";
  const trimmed = summary.trim().split(/\n+/)[0] ?? "";
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}


// ── Foldout Plate — radial civilization compass ──────────────────

function FoldoutPlate({
  civs,
  totalEntries,
}: {
  civs: CivCount[];
  totalEntries: number;
}) {
  const top = civs.slice(0, 16);
  const W = 700;
  const H = 700;
  const cx = W / 2;
  const cy = H / 2;
  const max = Math.max(...top.map((c) => c.entryCount), 1);
  const baseR = 80;
  const maxR = 280;
  const radius = (n: number) => baseR + (n / max) * (maxR - baseR);

  return (
    <div>
      <div className="text-center mb-4">
        <div
          className="font-display italic uppercase"
          style={{
            fontSize: 16,
            color: "var(--color-accent)",
            letterSpacing: "0.32em",
            marginBottom: 4,
          }}
        >
          Tabula plicabilis
        </div>
        <Display
          size={44}
          italic
          style={{ lineHeight: 1.04, letterSpacing: "-0.015em" }}
        >
          The civilizational compass, engraved.
        </Display>
        <p
          className="font-display italic mx-auto"
          style={{
            fontSize: 16,
            color: "var(--color-muted-foreground)",
            marginTop: 10,
            maxWidth: 720,
          }}
        >
          Each civilization plotted as a radial spoke; the length of the
          spoke proportional to its entry count in the corpus. European
          civilizations are italicised and rendered in <em>indigo</em>;
          the rest, in <em>vermilion</em>. The disparity in spoke length
          is the editorial commitment of this volume rendered as a
          diagram.
        </p>
      </div>
      <div className="flex justify-center py-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", maxWidth: 720, height: "auto" }}
        >
          {[5, 10, 15, 20, 25, 30].map((n) => (
            <circle
              key={n}
              cx={cx}
              cy={cy}
              r={radius(n)}
              fill="none"
              stroke="var(--color-border-faint)"
              strokeWidth={0.5}
              strokeDasharray="1 3"
            />
          ))}
          {top.map((c, i) => {
            const angle = -Math.PI / 2 + (i / top.length) * Math.PI * 2;
            const x1 = cx + Math.cos(angle) * baseR;
            const y1 = cy + Math.sin(angle) * baseR;
            const r = radius(c.entryCount);
            const x2 = cx + Math.cos(angle) * r;
            const y2 = cy + Math.sin(angle) * r;
            const lx = cx + Math.cos(angle) * (r + 22);
            const ly = cy + Math.sin(angle) * (r + 22);
            const anchor =
              Math.cos(angle) > 0.2
                ? "start"
                : Math.cos(angle) < -0.2
                  ? "end"
                  : "middle";
            const european = isEuropean(c.slug);
            const color = european ? "var(--color-ink-blue)" : "var(--color-accent)";
            return (
              <g key={c.slug}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={color}
                  strokeWidth={6}
                  opacity={0.9}
                  strokeLinecap="round"
                />
                <circle cx={x2} cy={y2} r={4} fill={color} />
                <text
                  x={lx}
                  y={ly + 4}
                  textAnchor={anchor}
                  fontFamily="var(--font-display)"
                  fontSize={13.5}
                  fontStyle={european ? "italic" : "normal"}
                  fill={
                    european
                      ? "var(--color-muted-foreground)"
                      : "var(--color-foreground)"
                  }
                >
                  {regionLabel(c.slug)}
                </text>
                <text
                  x={lx}
                  y={ly + 18}
                  textAnchor={anchor}
                  fontFamily="var(--font-mono)"
                  fontSize={9}
                  letterSpacing="0.12em"
                  fill="var(--color-muted-foreground)"
                >
                  n={c.entryCount}
                </text>
              </g>
            );
          })}
          <circle
            cx={cx}
            cy={cy}
            r={baseR - 6}
            fill="var(--color-background-elevated)"
            stroke="var(--color-foreground)"
            strokeWidth={1}
          />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontStyle="italic"
            fontSize={17}
            fill="var(--color-foreground)"
          >
            orbis terrarum
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={10}
            letterSpacing="0.22em"
            fill="var(--color-accent)"
          >
            n = {totalEntries.toLocaleString()}
          </text>
        </svg>
      </div>
      <div
        className="font-display italic text-center"
        style={{
          marginTop: 8,
          fontSize: 12,
          color: "var(--color-muted-foreground)",
        }}
      >
        engraved at the atelier · scale 1∶{totalEntries.toLocaleString()}
      </div>
    </div>
  );
}

// ── Continued Readings ────────────────────────────────────────────

function ContinuedReadings({ entries }: { entries: FeaturedEntity[] }) {
  return (
    <div>
      <div className="text-center mb-7">
        <div
          className="font-display italic uppercase"
          style={{
            fontSize: 16,
            color: "var(--color-accent)",
            letterSpacing: "0.32em",
            marginBottom: 4,
          }}
        >
          Lectiones
        </div>
        <Display
          size={48}
          italic
          style={{ lineHeight: 1.04, letterSpacing: "-0.015em" }}
        >
          Six readings, in brief.
        </Display>
      </div>
      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{ gap: "32px 56px" }}
      >
        {entries.map((entity, i) => (
          <ContinuedReading
            key={entity.slug}
            entity={entity}
            index={i + 1}
          />
        ))}
      </div>
    </div>
  );
}

function ContinuedReading({
  entity,
  index,
}: {
  entity: FeaturedEntity;
  index: number;
}) {
  const blurb =
    firstLine(entity.summary, 360) ||
    `${entity.type} · ${entity.era}${entity.primaryTag ? ` · ${regionLabel(entity.primaryTag)}` : ""}.`;
  return (
    <article
      className="pt-4"
      style={{ borderTop: "1px solid var(--color-rule)" }}
    >
      <Link
        href={`/entity/${entity.slug}`}
        className="block no-underline group"
        prefetch={false}
      >
        <div className="flex justify-between items-baseline mb-1.5">
          <span
            className="font-display italic uppercase"
            style={{
              fontSize: 13.5,
              letterSpacing: "0.18em",
              color: "var(--color-accent)",
            }}
          >
            Caput {romanNumeral(index)}
          </span>
          <MonoLabel size={10} track="0.18em" tone="muted">
            {fmtDateRange(entity.dateStart, "year", entity.dateEnd, "year") || "—"}
            {entity.primaryTag ? ` · ${regionLabel(entity.primaryTag)}` : ""}
          </MonoLabel>
        </div>
        <Display
          size={34}
          className="group-hover:text-accent transition-colors mb-2.5"
          style={{ letterSpacing: "-0.015em", lineHeight: 1 }}
        >
          {entity.name}
        </Display>
        <p
          className="font-display drop-cap"
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: "var(--color-foreground)",
            margin: 0,
            textAlign: "justify",
            hyphens: "auto",
          }}
        >
          {blurb}
        </p>
        <div
          className="font-display italic mt-3"
          style={{
            fontSize: 14,
            color: "var(--color-accent)",
          }}
        >
          continua lectio →
        </div>
      </Link>
    </article>
  );
}

// ── Civilization Index ────────────────────────────────────────────

function CivIndex({ civs }: { civs: CivCount[] }) {
  const top = civs.slice(0, 20);
  return (
    <div>
      <div className="text-center mb-5">
        <div
          className="font-display italic uppercase"
          style={{
            fontSize: 16,
            color: "var(--color-accent)",
            letterSpacing: "0.32em",
            marginBottom: 4,
          }}
        >
          Index civilizationum
        </div>
        <Display
          size={42}
          italic
          style={{ lineHeight: 1.04, letterSpacing: "-0.015em" }}
        >
          The full register, with counts.
        </Display>
        <p
          className="font-display italic mx-auto"
          style={{
            fontSize: 15,
            color: "var(--color-muted-foreground)",
            marginTop: 8,
            maxWidth: 540,
          }}
        >
          European civilisations are italicised. Click any name to
          consult its chapter.
        </p>
      </div>
      <div className="civ-index-columns">
        {top.map((c, i) => {
          const european = isEuropean(c.slug);
          return (
            <Link
              key={c.slug}
              href={`/civilization/${c.slug}`}
              className="flex justify-between items-baseline no-underline group"
              style={{
                padding: "7px 0",
                borderBottom: "1px solid var(--color-border)",
                breakInside: "avoid",
              }}
              prefetch={false}
            >
              <span>
                <MonoLabel
                  size={10}
                  track="0.18em"
                  tone={european ? "muted" : "accent"}
                  style={{ marginRight: 12 }}
                >
                  {String(i + 1).padStart(2, "0")}
                </MonoLabel>
                <span
                  className="font-display group-hover:text-accent transition-colors"
                  style={{
                    fontSize: 18,
                    color: european
                      ? "var(--color-muted-foreground)"
                      : "var(--color-foreground)",
                    fontStyle: european ? "italic" : "normal",
                  }}
                >
                  {regionLabel(c.slug)}
                </span>
              </span>
              <MonoLabel size={10} track="0.18em">
                {c.entryCount}
              </MonoLabel>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Viae lectionis — closing thread suggestions ──────────────────

function ViaeLectionis({ threads }: { threads: ThreadCard[] }) {
  return (
    <div>
      <div className="text-center mb-9">
        <div
          className="font-display italic uppercase"
          style={{
            fontSize: 16,
            color: "var(--color-accent)",
            letterSpacing: "0.32em",
            marginBottom: 4,
          }}
        >
          Viae lectionis
        </div>
        <Display
          size={48}
          italic
          style={{ lineHeight: 1.04, letterSpacing: "-0.015em" }}
        >
          Paths the editor suggests.
        </Display>
        <p
          className="font-display italic mx-auto mt-4"
          style={{
            fontSize: 17,
            color: "var(--color-muted-foreground)",
            maxWidth: 600,
          }}
        >
          Curated walks through five to seven entries — the simplest way
          to keep reading once a single chapter has begun.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-12 mb-10">
        {threads.map((t, i) => (
          <Link
            key={t.slug}
            href={`/thread/${t.slug}`}
            className="group block no-underline focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
            style={{
              borderTop: "1px solid var(--color-rule)",
              paddingTop: 18,
            }}
            prefetch={false}
          >
            <div className="flex items-baseline justify-between mb-3">
              <span
                className="font-display italic uppercase"
                style={{
                  fontSize: 12,
                  letterSpacing: "0.22em",
                  color: "var(--color-accent)",
                }}
              >
                Via {romanNumeral(i + 1)}
              </span>
              <MonoLabel size={9} track="0.18em" tone="muted">
                {t.entryCount} stops
              </MonoLabel>
            </div>
            <Display
              size={28}
              weight={400}
              as="h3"
              className="group-hover:text-accent transition-colors mb-3"
              style={{ letterSpacing: "-0.012em", lineHeight: 1.04 }}
            >
              {t.title}
            </Display>
            {t.blurb && (
              <p
                className="font-display italic"
                style={{
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "var(--color-muted-foreground)",
                  margin: 0,
                }}
              >
                {t.blurb}
              </p>
            )}
            <div
              className="font-display italic mt-3"
              style={{
                fontSize: 13.5,
                color: "var(--color-accent)",
              }}
            >
              continua lectio →
            </div>
          </Link>
        ))}
      </div>

      <div
        className="text-center pt-8"
        style={{ borderTop: "1px dotted var(--color-border)" }}
      >
        <Link
          href="/thread"
          className="font-mono text-[11px] uppercase tracking-[0.32em] text-accent hover:text-foreground transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
        >
          All threads →
        </Link>
        <span
          className="font-display italic mx-3"
          style={{
            fontSize: 14,
            color: "var(--color-muted-foreground)",
          }}
        >
          ·
        </span>
        <Link
          href="/random"
          className="font-mono text-[11px] uppercase tracking-[0.32em] text-muted-foreground hover:text-accent transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
        >
          A stranger in the stacks →
        </Link>
      </div>
    </div>
  );
}

// ── Main composition ─────────────────────────────────────────────

export function HomeScriptorium({
  featured,
  stats,
  civs,
  threads,
  featuredThread,
  erasWithEntries,
}: Props) {
  const readings = featured.slice(0, 6);
  // The featured thread is optional in case the editor hasn't picked
  // one yet; fall back to the preface so the slot is never empty.
  const showFeatured = featuredThread && featuredThread.entries.length > 0;

  return (
    <main className="codex-paper">
      <Folio>
        <Frontispiece stats={{ ...stats, eras: erasWithEntries || stats.eras }} />
      </Folio>

      {showFeatured ? (
        <Folio verso>
          <FeaturedThread thread={featuredThread} />
        </Folio>
      ) : (
        <Folio verso>
          <EditorsPreface stats={stats} />
        </Folio>
      )}

      <Folio>
        <AnthologyToc featured={featured} totalEntries={stats.entries} />
      </Folio>

      {civs.length > 0 && (
        <Folio verso>
          <FoldoutPlate civs={civs} totalEntries={stats.entries} />
        </Folio>
      )}

      {readings.length > 0 && (
        <Folio>
          <ContinuedReadings entries={readings} />
        </Folio>
      )}

      {civs.length > 0 && (
        <Folio verso>
          <CivIndex civs={civs} />
        </Folio>
      )}

      {threads.length > 0 && (
        <Folio>
          <ViaeLectionis threads={threads} />
        </Folio>
      )}

    </main>
  );
}

