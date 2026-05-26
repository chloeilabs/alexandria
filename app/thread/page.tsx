// Thread index — every curated path through the corpus, rendered as an
// editorial table of suggested readings.

import type { Metadata } from "next";
import Link from "next/link";

import { getAllThreads } from "@/lib/db/queries/thread";
import { MonoLabel, Display } from "@/components/scriptorium/primitives";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Threads · Alexandria",
  description:
    "Curated paths through the Library — five to seven entries that tell a continuous story.",
};

export default async function ThreadIndex() {
  const threads = await getAllThreads();

  return (
    <main className="min-h-screen pb-32 codex-paper">
      <header className="max-w-4xl mx-auto px-6 pt-20 pb-12">
        <div className="text-center">
          <MonoLabel tone="accent" size={11} track="0.32em" className="block mb-3">
            Itineraria lectoris
          </MonoLabel>
          <Display
            size={72}
            italic
            style={{ lineHeight: 1.02, letterSpacing: "-0.015em" }}
          >
            Threads.
          </Display>
          <p
            className="font-display italic mx-auto mt-5"
            style={{
              fontSize: 18,
              color: "var(--color-muted-foreground)",
              maxWidth: 600,
            }}
          >
            Curated paths through the Library — five to seven entries
            that tell a continuous story. Read them like a guided tour,
            or steal what you want and wander off.
          </p>
        </div>
      </header>

      <ul
        className="max-w-3xl mx-auto px-6 border-y"
        style={{
          borderColor: "var(--color-rule)",
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderStyle: "double",
          listStyle: "none",
          padding: "8px 24px",
          margin: "0 auto",
        }}
      >
        {threads.map((t, i) => (
          <li
            key={t.id}
            style={{
              borderBottom:
                i < threads.length - 1
                  ? "1px dotted var(--color-border)"
                  : "none",
              padding: "22px 0",
            }}
          >
            <Link
              href={`/thread/${t.slug}`}
              className="group block no-underline focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent"
              prefetch={false}
            >
              <div className="flex items-baseline justify-between gap-4 mb-2 flex-wrap">
                <span
                  className="font-display italic uppercase"
                  style={{
                    fontSize: 13,
                    letterSpacing: "0.18em",
                    color: "var(--color-accent)",
                  }}
                >
                  Caput {String(i + 1).padStart(2, "0")}
                </span>
                <MonoLabel size={10} track="0.18em" tone="muted">
                  {t.entryCount} {t.entryCount === 1 ? "stop" : "stops"}
                  {t.featured ? "  ·  featured" : ""}
                </MonoLabel>
              </div>
              <Display
                size={36}
                weight={400}
                className="group-hover:text-accent transition-colors mb-2"
                style={{ letterSpacing: "-0.015em", lineHeight: 1.04 }}
              >
                {t.title}
              </Display>
              {t.blurb && (
                <p
                  className="font-display italic"
                  style={{
                    fontSize: 17,
                    lineHeight: 1.55,
                    color: "var(--color-muted-foreground)",
                    margin: 0,
                    maxWidth: 680,
                  }}
                >
                  {t.blurb}
                </p>
              )}
              <div
                className="font-display italic mt-2"
                style={{
                  fontSize: 14,
                  color: "var(--color-accent)",
                }}
              >
                continua lectio →
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
