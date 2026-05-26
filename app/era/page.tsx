// Era index — five rows linking to /era/[id]. Rendered SCRIPTORIUM-
// style: a centred header, then a vertical register of the five eras
// with their year boundaries and entry counts in the editorial ledger
// pattern used on the homepage frontispiece.

import type { Metadata } from "next";
import Link from "next/link";

import { getEraCounts } from "@/lib/db/queries/era";
import { fmtYear } from "@/lib/format";
import { MonoLabel, Display } from "@/components/scriptorium/primitives";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eras · Alexandria",
  description:
    "Five eras of human history, from the deep past to the present day.",
};

export default async function EraIndex() {
  const eras = await getEraCounts();
  const total = eras.reduce((acc, e) => acc + e.entryCount, 0);

  return (
    <main className="min-h-screen pb-32 codex-paper">
      <header className="max-w-4xl mx-auto px-6 pt-20 pb-12">
        <div className="text-center">
          <MonoLabel tone="accent" size={11} track="0.32em" className="block mb-3">
            Tabula aetatum
          </MonoLabel>
          <Display
            size={72}
            italic
            style={{ lineHeight: 1.02, letterSpacing: "-0.015em" }}
          >
            By era.
          </Display>
          <p
            className="font-display italic mx-auto mt-5"
            style={{
              fontSize: 18,
              color: "var(--color-muted-foreground)",
              maxWidth: 600,
            }}
          >
            A coarser sieve than civilization — five windows across
            roughly five thousand years. Pick one and read across the
            world at once.
          </p>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6">
        <ul
          className="border-y"
          style={{
            borderColor: "var(--color-rule)",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderStyle: "double",
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {eras.map((e, i) => (
            <li
              key={e.id}
              style={{
                borderBottom:
                  i < eras.length - 1
                    ? "1px solid var(--color-border)"
                    : "none",
              }}
            >
              <Link
                href={`/era/${e.id}`}
                className="group block no-underline focus:outline-none focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent grid grid-cols-[40px_1fr_auto] md:grid-cols-[80px_1fr_180px_100px] items-baseline gap-4 md:gap-6 px-2 py-5 md:py-6"
                prefetch={false}
              >
                <MonoLabel size={11} track="0.24em" tone="accent">
                  {String(i + 1).padStart(2, "0")}
                </MonoLabel>
                <div className="min-w-0">
                  <Display
                    size={42}
                    weight={400}
                    className="group-hover:text-accent transition-colors"
                    style={{ letterSpacing: "-0.015em", lineHeight: 1 }}
                  >
                    {e.label}
                  </Display>
                  <MonoLabel
                    size={10}
                    track="0.18em"
                    tone="muted"
                    className="block mt-1.5 md:hidden"
                  >
                    {fmtYear(e.min)} – {fmtYear(e.max)} · {e.entryCount}{" "}
                    {e.entryCount === 1 ? "entry" : "entries"}
                  </MonoLabel>
                </div>
                <MonoLabel
                  size={10}
                  track="0.18em"
                  tone="muted"
                  className="hidden md:inline"
                >
                  {fmtYear(e.min)} – {fmtYear(e.max)}
                </MonoLabel>
                <span
                  className="font-display text-right hidden md:inline"
                  style={{
                    fontSize: 28,
                    color: "var(--color-accent)",
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {e.entryCount}
                  <MonoLabel
                    size={9}
                    track="0.18em"
                    className="block mt-0.5"
                  >
                    {e.entryCount === 1 ? "entry" : "entries"}
                  </MonoLabel>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p
          className="font-display italic text-center mt-6"
          style={{
            fontSize: 13,
            color: "var(--color-muted-foreground)",
          }}
        >
          {total.toLocaleString()} dated entries across five eras
        </p>
      </section>
    </main>
  );
}
