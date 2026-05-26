// Index of every civilization with at least one tagged entity. Rendered
// as the SCRIPTORIUM index of civilizations: a three-column register
// with rank numbers, italicised European entries, and year spans.

import type { Metadata } from "next";
import Link from "next/link";

import { getAllCivilizationSlugs } from "@/lib/db/queries/civilization";
import { fmtYear, regionLabel } from "@/lib/format";
import { MonoLabel, Display } from "@/components/scriptorium/primitives";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Civilizations · Alexandria",
  description:
    "Every civilization in the Library, organized by depth of coverage.",
};

// Same heuristic as the SCRIPTORIUM homepage index — keep them in
// sync so a slug reads the same on both pages.
const EUROPEAN_HINTS =
  /^(mediterranean|greek|roman|hellen|byzantin|renaissance|enlightenment|carolingian|frankish|holy-roman|norse|viking|anglo|saxon|merovingian|spanish-empire|venetian|florent|tuscan|german|prussia|polish|hungar|baltic|celt|gaul|iberian|portuguese|dutch|french|british|english|italian|european|modern-europe|early-modern-europe|world-wars-era)/i;

function isEuropean(slug: string): boolean {
  return EUROPEAN_HINTS.test(slug);
}

export default async function CivilizationIndex() {
  const civs = await getAllCivilizationSlugs();

  return (
    <main className="min-h-screen pb-32 codex-paper">
      <header className="max-w-5xl mx-auto px-6 pt-20 pb-12">
        <div className="text-center">
          <MonoLabel tone="accent" size={11} track="0.32em" className="block mb-3">
            Index civilizationum
          </MonoLabel>
          <Display
            size={64}
            italic
            style={{ lineHeight: 1.02, letterSpacing: "-0.015em" }}
          >
            The Library&rsquo;s civilizations.
          </Display>
          <p
            className="font-display italic mx-auto mt-5"
            style={{
              fontSize: 18,
              color: "var(--color-muted-foreground)",
              maxWidth: 620,
            }}
          >
            The full register, with counts. European traditions are
            italicised; the rest are set upright — the visual tilt is
            the editorial commitment of this volume rendered as
            typography.
          </p>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6">
        <div
          className="border-y"
          style={{
            borderColor: "var(--color-rule)",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderStyle: "double",
            padding: "20px 0",
          }}
        >
          <div className="civ-index-columns">
            {civs.map((c, i) => {
              const european = isEuropean(c.slug);
              const span =
                c.minYear != null && c.maxYear != null
                  ? `${fmtYear(c.minYear)} – ${fmtYear(c.maxYear)}`
                  : "";
              return (
                <Link
                  key={c.slug}
                  href={`/civilization/${c.slug}`}
                  className="block no-underline group focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
                  style={{
                    padding: "8px 0",
                    borderBottom: "1px solid var(--color-border)",
                    breakInside: "avoid",
                  }}
                  prefetch={false}
                >
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: "24px 1fr auto",
                      gap: 10,
                      alignItems: "baseline",
                    }}
                  >
                    <MonoLabel
                      size={10}
                      track="0.18em"
                      tone={european ? "muted" : "accent"}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </MonoLabel>
                    <span
                      className="font-display group-hover:text-accent transition-colors"
                      style={{
                        fontSize: 16,
                        lineHeight: 1.2,
                        color: european
                          ? "var(--color-muted-foreground)"
                          : "var(--color-foreground)",
                        fontStyle: european ? "italic" : "normal",
                      }}
                    >
                      {regionLabel(c.slug)}
                    </span>
                    <MonoLabel size={10} track="0.18em">
                      {c.entryCount}
                    </MonoLabel>
                  </div>
                  {span && (
                    <MonoLabel
                      size={9}
                      track="0.16em"
                      tone="muted"
                      className="block"
                      style={{ marginLeft: 34, marginTop: 2 }}
                    >
                      {span}
                    </MonoLabel>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
        <p
          className="font-display italic text-center mt-6"
          style={{
            fontSize: 13,
            color: "var(--color-muted-foreground)",
          }}
        >
          {civs.length} civilizations · ordered by count
        </p>
      </section>
    </main>
  );
}
