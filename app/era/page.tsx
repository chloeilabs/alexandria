// Era index — five rows linking to /era/[id], each showing the year
// boundaries and the count of entries currently in the corpus.

import type { Metadata } from "next";
import Link from "next/link";

import { getEraCounts } from "@/lib/db/queries/era";
import { fmtYear } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eras · Alexandria",
  description:
    "Five eras of human history, from the deep past to the present day.",
};

export default async function EraIndex() {
  const eras = await getEraCounts();

  return (
    <main className="min-h-screen pb-32">
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6">
          Five eras
        </div>
        <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.02] tracking-tight text-foreground">
          By era
        </h1>
        <p className="mt-6 font-display italic text-xl leading-relaxed text-muted-foreground border-l-2 border-accent/40 pl-5">
          A coarser sieve than civilization — five windows across five
          thousand years. Pick one and read across the world at once.
        </p>
      </header>

      <ul className="max-w-3xl mx-auto px-6 divide-y divide-border/60">
        {eras.map((e) => (
          <li key={e.id} className="py-7">
            <Link
              href={`/era/${e.id}`}
              className="group block focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
            >
              <div className="flex items-baseline gap-4 flex-wrap mb-2">
                <h2 className="font-display text-3xl md:text-4xl text-foreground group-hover:text-accent transition-colors">
                  {e.label}
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {fmtYear(e.min)} – {fmtYear(e.max)}
                  {`  ·  ${e.entryCount} ${e.entryCount === 1 ? "entry" : "entries"}`}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
