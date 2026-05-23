// Thread index — every curated path through the corpus.

import type { Metadata } from "next";
import Link from "next/link";

import { getAllThreads } from "@/lib/db/queries/thread";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Threads · Alexandria",
  description:
    "Curated paths through the Library — five to seven entries that tell a continuous story.",
};

export default async function ThreadIndex() {
  const threads = await getAllThreads();

  return (
    <main className="min-h-screen pb-32">
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6">
          {threads.length} {threads.length === 1 ? "thread" : "threads"}
        </div>
        <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.02] tracking-tight text-foreground">
          Threads
        </h1>
        <p className="mt-6 font-display italic text-xl leading-relaxed text-muted-foreground border-l-2 border-accent/40 pl-5">
          Curated paths through the Library — five to seven entries that tell
          a continuous story. Read them like a guided tour, or steal what you
          want and wander off.
        </p>
      </header>

      <ul className="max-w-3xl mx-auto px-6 divide-y divide-border/60">
        {threads.map((t) => (
          <li key={t.id} className="py-7">
            <Link
              href={`/thread/${t.slug}`}
              className="group block focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
            >
              <div className="flex items-baseline gap-4 flex-wrap mb-2">
                <h2 className="font-display text-3xl md:text-4xl text-foreground group-hover:text-accent transition-colors">
                  {t.title}
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {t.entryCount} {t.entryCount === 1 ? "entry" : "entries"}
                  {t.featured ? "  ·  featured" : ""}
                </span>
              </div>
              {t.blurb && (
                <p className="font-display italic text-lg leading-relaxed text-muted-foreground">
                  {t.blurb}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
