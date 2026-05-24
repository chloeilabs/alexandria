"use client";

// Thin persistent top nav. Met-Museum-style on desktop: small, fixed,
// all-caps mono. On mobile (≤ md): brand stays visible, links collapse
// behind a "menu" disclosure since fitting 8 links + brand on a 360px
// viewport is hopeless.

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

const LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/search", label: "Search" },
  { href: "/timeline", label: "Timeline" },
  { href: "/map", label: "Map" },
  { href: "/graph", label: "Graph" },
  { href: "/thread", label: "Threads" },
  { href: "/civilization", label: "Civilizations" },
  { href: "/era", label: "Eras" },
  { href: "/random", label: "Random" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-40 w-full border-b border-border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      aria-label="Site navigation"
    >
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between gap-6">
        <Link
          href="/"
          className="font-display italic text-base text-foreground hover:text-accent transition-colors whitespace-nowrap focus:outline-none focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4"
        >
          Alexandria
        </Link>

        {/* Desktop links — visible from md up */}
        <ul className="hidden md:flex items-center gap-6">
          {LINKS.map((l) => {
            const isActive = pathname === l.href;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={
                    "font-mono text-[10px] uppercase tracking-[0.18em] transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4 " +
                    (isActive
                      ? "text-accent"
                      : "text-muted-foreground hover:text-accent")
                  }
                  aria-current={isActive ? "page" : undefined}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Mobile menu trigger — visible below md */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="md:hidden font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
          aria-expanded={open}
          aria-controls="mobile-nav-panel"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {/* Mobile expanded panel */}
      {open && (
        <div
          id="mobile-nav-panel"
          className="md:hidden border-t border-border bg-background"
        >
          <ul className="px-6 py-4 grid grid-cols-2 gap-y-3 gap-x-4">
            {LINKS.map((l) => {
              const isActive = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={
                      "block py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4 " +
                      (isActive
                        ? "text-accent"
                        : "text-muted-foreground hover:text-accent")
                    }
                    aria-current={isActive ? "page" : undefined}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}
