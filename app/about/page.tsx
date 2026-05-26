// The /about page. Rendered as the SCRIPTORIUM editor's note —
// centred frontispiece header, then editorial sections set in the
// display face for reading-room density. Source of project intent.

import type { Metadata } from "next";
import Link from "next/link";
import { APP_DESCRIPTION } from "@/lib/site";
import { MonoLabel, Display } from "@/components/scriptorium/primitives";

export const metadata: Metadata = {
  title: "About · Alexandria",
  description: APP_DESCRIPTION,
};

function SectionHead({
  kicker,
  title,
}: {
  kicker: string;
  title: string;
}) {
  return (
    <div className="mb-7">
      <MonoLabel tone="accent" size={11} track="0.32em" className="block mb-2">
        ¶ {kicker}
      </MonoLabel>
      <Display
        size={36}
        italic
        weight={400}
        as="h2"
        style={{ letterSpacing: "-0.012em", lineHeight: 1.06 }}
      >
        {title}
      </Display>
    </div>
  );
}

const PROSE_STYLE: React.CSSProperties = {
  fontSize: 19,
  lineHeight: 1.65,
  color: "var(--color-foreground)",
  textAlign: "justify",
  hyphens: "auto",
};

const ACCENT_LINK =
  "text-accent hover:text-foreground transition-colors underline decoration-dotted underline-offset-2 focus:outline-none focus-visible:text-foreground";

export default function AboutPage() {
  return (
    <main className="min-h-screen pb-32 codex-paper">
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-10 text-center">
        <div
          className="font-display"
          style={{
            fontSize: 20,
            color: "var(--color-accent)",
            letterSpacing: "0.6em",
            marginBottom: 14,
          }}
        >
          ❦
        </div>
        <MonoLabel tone="accent" size={11} track="0.32em" className="block mb-3">
          De hoc opere
        </MonoLabel>
        <Display
          size={84}
          italic
          style={{ letterSpacing: "-0.02em", lineHeight: 0.96 }}
        >
          A digital encyclopedia.
        </Display>
        <p
          className="font-display italic mx-auto mt-7"
          style={{
            fontSize: 21,
            lineHeight: 1.55,
            color: "var(--color-muted-foreground)",
            maxWidth: 640,
          }}
        >
          {APP_DESCRIPTION} It is not a timeline website. It is an
          interconnected web of stories that someone can follow from the
          fall of Rome to Mongol siege warfare to Byzantine plumbing.
        </p>
        <div className="mx-auto mt-7" style={{ width: 280 }}>
          <div style={{ height: 1, background: "var(--color-rule)", marginBottom: 4 }} />
          <div style={{ height: 3, background: "var(--color-accent)", marginBottom: 4 }} />
          <div style={{ height: 1, background: "var(--color-rule)" }} />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 space-y-16">
        <section>
          <SectionHead kicker="Tabula" title="What you’re looking at." />
          <p className="font-display drop-cap" style={PROSE_STYLE}>
            Every entry on Alexandria sits in one of four tiers. The
            base — Tier&nbsp;0 — is a stub: a name, a span of dates, a
            handful of relationships pulled from Wikidata. Stubs surface
            only through other entries; they never appear on the
            homepage or in search results above the fold. They mark the
            spaces the Library is still growing into.
          </p>
          <p className="font-display mt-5" style={{ ...PROSE_STYLE, textIndent: "1.6em" }}>
            <span style={{ color: "var(--color-accent)", marginRight: 6 }}>¶</span>
            Tier&nbsp;1 entries have a 150–300&nbsp;word summary,
            adapted from Wikipedia’s lead section through a rewrite
            layer. Tier&nbsp;2 entries have a full <em>800–1,500
            word</em> narrative, synthesised across Wikipedia and (where
            available) the 1911 Encyclopædia Britannica — multi-source
            synthesis rather than paraphrase. Each Tier&nbsp;2 piece is
            fact-checked by a separate model run; flagged claims are
            surfaced on the entry itself.
          </p>
          <p className="font-display mt-5" style={{ ...PROSE_STYLE, textIndent: "1.6em" }}>
            <span style={{ color: "var(--color-accent)", marginRight: 6 }}>¶</span>
            Tier&nbsp;3 is the curated layer — hand-picked imagery,
            longer-form prose (2,500–3,500&nbsp;words), no algorithmic
            caps. The ten anchors are Hannibal, Mansa Musa, Wu Zetian,
            Hatshepsut, Songhai, Saladin, Murasaki Shikibu, Akbar, Túpac
            Amaru&nbsp;II, and the Bronze-Age Collapse.
          </p>
        </section>

        <section>
          <SectionHead
            kicker="Editorial"
            title="What it tries to do differently."
          />
          <p className="font-display" style={PROSE_STYLE}>
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
            Hannibal to Mansa Musa to Wu Zetian to Túpac Amaru&nbsp;II.
          </p>
          <p className="font-display mt-5" style={{ ...PROSE_STYLE, textIndent: "1.6em" }}>
            <span style={{ color: "var(--color-accent)", marginRight: 6 }}>¶</span>
            Beyond that: the prose is meant to read like the best
            long-form journalism, not like a textbook. Each entry has
            permission to lead with a paradox or an image, develop
            context at length, and close on a question that opens to
            other entries. Where the sources disagree, the disagreement
            is named rather than papered over.
          </p>
        </section>

        <section>
          <SectionHead
            kicker="Manufactura"
            title="How the prose is made."
          />
          <p className="font-display" style={PROSE_STYLE}>
            A continuously-running pipeline upgrades entries through the
            tiers as inbound interest, source density, and editorial
            attention warrant. Summarisation and narration are done by
            Google’s Gemini&nbsp;3.5&nbsp;Flash via the Vercel AI
            Gateway, with a hard daily budget cap. Embeddings (used for
            semantic search and the “Adjacent in spirit” widget on every
            entry) are Voyage&nbsp;3&nbsp;large, 1,024 dimensions,
            cosine-ranked through pgvector with HNSW indexing.
          </p>
          <p className="font-display mt-5" style={{ ...PROSE_STYLE, textIndent: "1.6em" }}>
            <span style={{ color: "var(--color-accent)", marginRight: 6 }}>¶</span>
            The prose layer is constrained: cite only facts present in
            the provided sources; never invent dates, quotes, places,
            borders, or scholarly attributions; flag disagreements
            briefly rather than picking a side and burying the other.
            The fact-check pass that runs after each narrative is a
            second model run reading the same sources, asked to surface
            every claim the sources don’t support. Findings get
            published alongside the narrative — readers see what the
            system itself is uncertain about.
          </p>
        </section>

        <section>
          <SectionHead
            kicker="Auctoritates"
            title="Sources, licensing, and the work behind it."
          />
          <p className="font-display" style={PROSE_STYLE}>
            Wikipedia content is adapted under{" "}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noreferrer noopener"
              className={ACCENT_LINK}
            >
              CC&nbsp;BY-SA&nbsp;4.0
            </a>
            . The 1911 Encyclopædia Britannica is public domain in the
            United States; entries are pulled via{" "}
            <a
              href="https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica"
              target="_blank"
              rel="noreferrer noopener"
              className={ACCENT_LINK}
            >
              Wikisource
            </a>
            . Imagery is from{" "}
            <a
              href="https://commons.wikimedia.org/"
              target="_blank"
              rel="noreferrer noopener"
              className={ACCENT_LINK}
            >
              Wikimedia Commons
            </a>
            , with per-image attribution and license shown on each entry.
          </p>
          <p className="font-display mt-5" style={{ ...PROSE_STYLE, textIndent: "1.6em" }}>
            <span style={{ color: "var(--color-accent)", marginRight: 6 }}>¶</span>
            The code is open source at{" "}
            <a
              href="https://github.com/chloeilabs/alexandria"
              target="_blank"
              rel="noreferrer noopener"
              className={ACCENT_LINK}
            >
              github.com/chloeilabs/alexandria
            </a>
            . The stack is Next.js&nbsp;16 + Postgres&nbsp;17 with the
            pgvector extension + Drizzle&nbsp;ORM, deployed on Vercel
            with Neon as the production database.
          </p>
        </section>

        <section>
          <SectionHead kicker="Incipit" title="Where to start." />
          <p className="font-display" style={PROSE_STYLE}>
            Try the{" "}
            <Link href="/thread" className={ACCENT_LINK}>
              threads
            </Link>{" "}
            — curated paths through five to seven entries that tell a
            continuous story. Or browse{" "}
            <Link href="/civilization" className={ACCENT_LINK}>
              civilizations
            </Link>{" "}
            if you want to read across one part of the world.{" "}
            <Link href="/random" className={ACCENT_LINK}>
              Random
            </Link>{" "}
            drops you on a curated entry; from there, the connections
            link onward.
          </p>
        </section>

        <div className="text-center pt-8">
          <div
            className="font-display"
            style={{
              fontSize: 22,
              color: "var(--color-accent)",
              letterSpacing: "0.6em",
            }}
          >
            ❦ · ❦ · ❦
          </div>
          <MonoLabel
            tone="muted"
            size={10}
            track="0.32em"
            className="block mt-4"
          >
            Explicit praefatio
          </MonoLabel>
        </div>
      </div>
    </main>
  );
}
