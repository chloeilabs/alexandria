// Index of every civilization with at least one tagged entity. Ordered by
// entity count (densest first) so the table of contents reads as "where is
// the most to learn right now."

import type { Metadata } from "next";
import Link from "next/link";

import { getAllCivilizationSlugs } from "@/lib/db/queries/civilization";
import { fmtYear, regionLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Civilizations · Alexandria",
  description:
    "Every civilization in the Library, organized by depth of coverage.",
};

export default async function CivilizationIndex() {
  const civs = await getAllCivilizationSlugs();

  return (
    <main className="min-h-screen pb-32">
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6">
          {civs.length} civilizations
        </div>
        <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.02] tracking-tight text-foreground">
          The Library&rsquo;s civilizations
        </h1>
        <p className="mt-6 font-display italic text-xl leading-relaxed text-muted-foreground border-l-2 border-accent/40 pl-5">
          A reading list, organized by where in the world a story unfolded.
          Pick a civilization and walk its centuries.
        </p>
      </header>

      <ul className="max-w-3xl mx-auto px-6 divide-y divide-border/60">
        {civs.map((c) => {
          const span =
            c.minYear != null && c.maxYear != null
              ? `${fmtYear(c.minYear)} – ${fmtYear(c.maxYear)}`
              : "";
          return (
            <li key={c.slug} className="py-6">
              <Link
                href={`/civilization/${c.slug}`}
                className="group flex items-baseline gap-4 flex-wrap focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
              >
                <span className="font-display text-2xl text-foreground group-hover:text-accent transition-colors">
                  {regionLabel(c.slug)}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {c.entryCount} {c.entryCount === 1 ? "entry" : "entries"}
                  {span ? `  ·  ${span}` : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
