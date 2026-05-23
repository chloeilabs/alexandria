// Thin persistent top nav — the only chrome shared across every page.
// Met-Museum-style: small, fixed, all-caps mono.

import Link from "next/link";

const LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/search", label: "Search" },
  { href: "/timeline", label: "Timeline" },
  { href: "/map", label: "Map" },
  { href: "/graph", label: "Graph" },
  { href: "/civilization", label: "Civilizations" },
];

export function SiteNav() {
  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between gap-6">
        <Link
          href="/"
          className="font-display italic text-base text-foreground hover:text-accent transition-colors whitespace-nowrap"
        >
          Alexandria
        </Link>
        <ul className="flex items-center gap-6">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-accent transition-colors"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
