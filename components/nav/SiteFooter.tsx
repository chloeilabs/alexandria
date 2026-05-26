// Editorial SCRIPTORIUM footer — colophon-style, restrained.
// Centre: the ❦ glyph above the mast + tagline. Below: a three-row
// run of editorial blocks (browse · sources · licence) over a thin
// hairline. Closes with year + repo link.

import Link from "next/link";
import { APP_DESCRIPTION } from "@/lib/site";
import { Ornament } from "@/components/scriptorium/Ornament";

const YEAR_BUILT = "2026";

const BROWSE = [
  { href: "/thread", label: "Threads" },
  { href: "/civilization", label: "Civilizations" },
  { href: "/era", label: "Eras" },
  { href: "/timeline", label: "Timeline" },
  { href: "/map", label: "Map" },
  { href: "/graph", label: "Graph" },
  { href: "/random", label: "Random entry" },
  { href: "/about", label: "About" },
];

export function SiteFooter() {
  return (
    <footer
      className="border-t"
      style={{
        borderColor: "var(--color-rule)",
        borderTopWidth: 1,
        borderTopStyle: "double",
        background: "var(--color-background-elevated)",
      }}
    >
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="text-center mb-12">
          <Ornament
            maxWidth={280}
            hollowFill="var(--color-background-elevated)"
            style={{ marginBottom: 18 }}
          />
          <Link
            href="/"
            className="font-display italic hover:text-accent transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
            style={{
              fontSize: 28,
              color: "var(--color-foreground)",
              letterSpacing: "-0.01em",
            }}
          >
            Alexandria
          </Link>
          <p
            className="font-display italic mx-auto mt-3"
            style={{
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--color-muted-foreground)",
              maxWidth: 480,
            }}
          >
            {APP_DESCRIPTION} Begin anywhere; follow the threads.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-10 gap-x-12">
          <nav aria-label="Footer navigation">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-4">
              ¶ Browse
            </h2>
            <ul className="space-y-2 font-display text-base text-muted-foreground">
              {BROWSE.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="hover:text-accent transition-colors focus:outline-none focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-4">
              ¶ Sources &amp; licensing
            </h2>
            <ul className="space-y-2 font-display text-[15px] text-muted-foreground leading-relaxed">
              <li>
                Adapted prose from{" "}
                <a
                  href="https://en.wikipedia.org/wiki/Wikipedia:About"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent/80 hover:text-accent transition-colors underline decoration-dotted underline-offset-2"
                >
                  Wikipedia
                </a>{" "}
                under{" "}
                <a
                  href="https://creativecommons.org/licenses/by-sa/4.0/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent/80 hover:text-accent transition-colors underline decoration-dotted underline-offset-2"
                >
                  CC BY-SA 4.0
                </a>
                .
              </li>
              <li>
                1911{" "}
                <a
                  href="https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent/80 hover:text-accent transition-colors underline decoration-dotted underline-offset-2"
                >
                  Encyclopædia Britannica
                </a>{" "}
                — public domain in the United States.
              </li>
              <li>
                Imagery via{" "}
                <a
                  href="https://commons.wikimedia.org/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent/80 hover:text-accent transition-colors underline decoration-dotted underline-offset-2"
                >
                  Wikimedia Commons
                </a>
                ; per-image attribution on each entry.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-4">
              ¶ Colophon
            </h2>
            <p
              className="font-display italic"
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                color: "var(--color-muted-foreground)",
              }}
            >
              Set in EB Garamond and JetBrains Mono. Built on Next.js 16
              + Postgres 17 with pgvector + Drizzle ORM, deployed to
              Vercel atop a Neon Postgres branch.
            </p>
            <p
              className="font-display mt-3"
              style={{
                fontSize: 15,
                color: "var(--color-muted-foreground)",
              }}
            >
              Source at{" "}
              <a
                href="https://github.com/chloeilabs/alexandria"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent/80 hover:text-accent transition-colors underline decoration-dotted underline-offset-2"
              >
                github.com/chloeilabs/alexandria
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      <div
        className="border-t"
        style={{ borderColor: "var(--color-border-faint)" }}
      >
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-baseline justify-between flex-wrap gap-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
            Alexandria · MMXXVI
          </span>
          <span
            className="font-display italic"
            style={{
              fontSize: 14,
              color: "var(--color-muted-foreground)",
              opacity: 0.7,
            }}
          >
            Explicit colophon · {YEAR_BUILT}
          </span>
        </div>
      </div>
    </footer>
  );
}
