// The /about page. Context for new visitors who land on a random entity
// page and want to know what this site is.

import type { Metadata } from "next";
import Link from "next/link";
import { APP_DESCRIPTION } from "@/lib/site";

export const metadata: Metadata = {
  title: "About · Alexandria",
  description: APP_DESCRIPTION,
};

export default function AboutPage() {
  return (
    <main className="min-h-screen pb-32">
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6">
          About
        </div>
        <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.02] tracking-tight text-foreground">
          A digital
          <br />
          encyclopedia
        </h1>
        <p className="mt-8 font-display italic text-2xl text-muted-foreground leading-snug border-l-2 border-accent/40 pl-5 max-w-2xl">
          {APP_DESCRIPTION} It is not a timeline website. It is an
          interconnected web of stories that someone can follow from the fall
          of Rome to Mongol siege warfare to Byzantine plumbing.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-6 space-y-16">
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6 border-t border-border pt-8">
            What you&rsquo;re looking at
          </h2>
          <div className="space-y-6 text-lg leading-[1.85] text-foreground">
            <p>
              Every entry on Alexandria sits in one of four tiers. The
              base — Tier&nbsp;0 — is a stub: a name, a span of dates, a
              handful of relationships pulled from Wikidata. Stubs surface
              only through other entries; they never appear on the homepage
              or in search results above the fold. They mark the spaces
              the Library is still growing into.
            </p>
            <p>
              Tier&nbsp;1 entries have a 150–300&nbsp;word summary, adapted
              from Wikipedia&apos;s lead section through a rewrite layer.
              Tier&nbsp;2 entries have a full
              <em> 800–1,500 word </em> narrative, synthesised across
              Wikipedia and (where available) the 1911 Encyclopædia
              Britannica — multi-source synthesis rather than paraphrase.
              Each Tier&nbsp;2 piece is fact-checked by a separate model
              run; flagged claims are surfaced on the entry itself.
            </p>
            <p>
              Tier&nbsp;3 is the curated layer — hand-picked imagery,
              longer-form prose (2,500–3,500&nbsp;words), no algorithmic
              caps. There are five Tier&nbsp;3 entries at launch; more
              will arrive as the editorial work continues.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6 border-t border-border pt-8">
            What it tries to do differently
          </h2>
          <div className="space-y-6 text-lg leading-[1.85] text-foreground">
            <p>
              Most encyclopedias of human history default to the West.
              Wikipedia is denser in English; English is densest on
              European subjects; the long tail of non-European history is
              underrepresented even when the underlying scholarship is
              rich. Alexandria explicitly resists that default at every
              layer: the seed filter rewards entries with sitelinks in
              non-European Wikipedias, the homepage rotation never lets
              one civilisation dominate, civilisational tags are curated
              rather than imposed from the UN subregion map, and the
              calibration set the prose was tuned against runs from
              Hannibal to Mansa Musa to Wu Zetian to Tupac Amaru&nbsp;II.
            </p>
            <p>
              Beyond that: the prose is meant to read like the best
              long-form journalism, not like a textbook. Each entry has
              permission to lead with a paradox or an image, develop
              context at length, and close on a question that opens to
              other entries. Where the sources disagree, the disagreement
              is named rather than papered over.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6 border-t border-border pt-8">
            How the prose is made
          </h2>
          <div className="space-y-6 text-lg leading-[1.85] text-foreground">
            <p>
              A continuously-running pipeline upgrades entries through the
              tiers as inbound interest, source density, and editorial
              attention warrant. Summarisation and narration are done by
              Google&apos;s Gemini 3.5&nbsp;Flash via the Vercel AI
              Gateway, with a hard daily budget cap. Embeddings (used for
              semantic search and the &ldquo;Adjacent in spirit&rdquo;
              widget on every entry) are Voyage 3&nbsp;large, 1,024
              dimensions, cosine-ranked through pgvector with HNSW
              indexing.
            </p>
            <p>
              The prose layer is constrained: cite only facts present in
              the provided sources; never invent dates, quotes, places,
              borders, or scholarly attributions; flag disagreements
              briefly rather than picking a side and burying the other.
              The fact-check pass that runs after each narrative is a
              second model run reading the same sources, asked to surface
              every claim the sources don&apos;t support. Findings get
              published alongside the narrative — readers see what the
              system itself is uncertain about.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6 border-t border-border pt-8">
            Sources, licensing, and the work behind it
          </h2>
          <div className="space-y-6 text-lg leading-[1.85] text-foreground">
            <p>
              Wikipedia content is adapted under{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent hover:text-foreground transition-colors underline decoration-dotted underline-offset-2"
              >
                CC&nbsp;BY-SA&nbsp;4.0
              </a>
              . The 1911 Encyclopædia Britannica is public domain in the
              United States; entries are pulled via{" "}
              <a
                href="https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent hover:text-foreground transition-colors underline decoration-dotted underline-offset-2"
              >
                Wikisource
              </a>
              . Imagery is from{" "}
              <a
                href="https://commons.wikimedia.org/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent hover:text-foreground transition-colors underline decoration-dotted underline-offset-2"
              >
                Wikimedia Commons
              </a>
              , with per-image attribution and license shown on each entry.
            </p>
            <p>
              The code is open source at{" "}
              <a
                href="https://github.com/chloeilabs/alexandria"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent hover:text-foreground transition-colors underline decoration-dotted underline-offset-2"
              >
                github.com/chloeilabs/alexandria
              </a>
              . The stack is Next.js&nbsp;16 + Postgres&nbsp;17 with the
              pgvector extension + Drizzle&nbsp;ORM, deployed on Vercel
              with Neon as the production database.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6 border-t border-border pt-8">
            Where to start
          </h2>
          <div className="space-y-6 text-lg leading-[1.85] text-foreground">
            <p>
              Try the{" "}
              <Link
                href="/thread"
                className="text-accent hover:text-foreground transition-colors underline decoration-dotted underline-offset-2"
              >
                threads
              </Link>{" "}
              — curated paths through five to seven entries that tell a
              continuous story. Or browse{" "}
              <Link
                href="/civilization"
                className="text-accent hover:text-foreground transition-colors underline decoration-dotted underline-offset-2"
              >
                civilizations
              </Link>{" "}
              if you want to read across one part of the world.{" "}
              <Link
                href="/random"
                className="text-accent hover:text-foreground transition-colors underline decoration-dotted underline-offset-2"
              >
                Random
              </Link>{" "}
              drops you on a curated entry; from there, the connections
              link onward.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
