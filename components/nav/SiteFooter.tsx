// Site-wide footer. The plan calls for "source attribution footer with all
// sources used" on entity pages — that's still there, with the specific
// per-entity sources. This footer is the project-level credit: where the
// content broadly comes from, what licence covers it, who built the site.

import Link from "next/link";
import { APP_DESCRIPTION } from "@/lib/site";

const YEAR_BUILT = "2026";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-border bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-y-10 gap-x-12">
        {/* Mast — brand + one-line tagline */}
        <div className="space-y-3">
          <Link
            href="/"
            className="font-display italic text-2xl text-foreground hover:text-accent transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
          >
            Alexandria
          </Link>
          <p className="font-display italic text-base text-muted-foreground max-w-xs leading-snug">
            {APP_DESCRIPTION} Begin anywhere; follow the threads.
          </p>
        </div>

        {/* Browse */}
        <nav aria-label="Footer navigation">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-4">
            Browse
          </h2>
          <ul className="space-y-2 text-base text-muted-foreground">
            {[
              { href: "/thread", label: "Threads" },
              { href: "/civilization", label: "Civilizations" },
              { href: "/era", label: "Eras" },
              { href: "/timeline", label: "Timeline" },
              { href: "/map", label: "Map" },
              { href: "/graph", label: "Graph" },
              { href: "/random", label: "Random entry" },
              { href: "/about", label: "About" },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="hover:text-foreground transition-colors focus:outline-none focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sources + licensing */}
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-4">
            Sources &amp; licensing
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>
              Adapted prose from{" "}
              <a
                href="https://en.wikipedia.org/wiki/Wikipedia:About"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent/70 hover:text-accent transition-colors underline decoration-dotted underline-offset-2 focus:outline-none focus-visible:text-accent"
              >
                Wikipedia
              </a>{" "}
              under{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent/70 hover:text-accent transition-colors underline decoration-dotted underline-offset-2 focus:outline-none focus-visible:text-accent"
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
                className="text-accent/70 hover:text-accent transition-colors underline decoration-dotted underline-offset-2 focus:outline-none focus-visible:text-accent"
              >
                Encyclopædia Britannica
              </a>{" "}
              entries used as a second source where available — public domain
              in the United States.
            </li>
            <li>
              Imagery via{" "}
              <a
                href="https://commons.wikimedia.org/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent/70 hover:text-accent transition-colors underline decoration-dotted underline-offset-2 focus:outline-none focus-visible:text-accent"
              >
                Wikimedia Commons
              </a>
              ; individual attribution shown on each entry.
            </li>
            <li>
              Source code at{" "}
              <a
                href="https://github.com/chloeilabs/alexandria"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent/70 hover:text-accent transition-colors underline decoration-dotted underline-offset-2 focus:outline-none focus-visible:text-accent"
              >
                github.com/chloeilabs/alexandria
              </a>
              .
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-baseline justify-between flex-wrap gap-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
            Alexandria · {YEAR_BUILT}
          </span>
          <span className="font-display italic text-sm text-muted-foreground/70">
            Begin anywhere; follow the threads.
          </span>
        </div>
      </div>
    </footer>
  );
}
