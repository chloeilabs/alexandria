"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ThemeToggle } from "@/components/theme/ThemeToggle";

function useSearchShortcut() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      const input = document.getElementById("q") as HTMLInputElement | null;
      if (input) {
        input.focus();
        input.select();
      } else {
        router.push("/search");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname]);
}

const LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/browse", label: "Browse" },
  { href: "/quality", label: "Quality" },
  { href: "/about", label: "About" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useSearchShortcut();

  return (
    <nav
      className="sticky top-0 z-40 w-full border-b backdrop-blur"
      style={{
        borderColor: "var(--color-border)",
        background:
          "color-mix(in srgb, var(--color-background-elevated) 88%, transparent)",
      }}
      aria-label="Site navigation"
    >
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between gap-6">
        <Link
          href="/"
          className="group font-display italic text-lg text-foreground hover:text-accent transition-colors whitespace-nowrap focus:outline-none focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4 inline-flex items-center"
        >
          <span
            aria-hidden="true"
            className="not-italic group-hover:text-accent transition-colors"
            style={{
              color: "var(--color-accent)",
              fontSize: "1.15em",
              lineHeight: 1,
              letterSpacing: 0,
              marginRight: "0.45em",
              transform: "translateY(0.04em)",
            }}
          >
            ❦
          </span>
          <span>Alexandria</span>
        </Link>

        <ul className="hidden md:flex items-center gap-6">
          {LINKS.map((l) => {
            const isActive = pathname === l.href;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={
                    "font-mono text-[10px] uppercase tracking-[0.20em] transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4 " +
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
          <li
            className="pl-3 ml-3 border-l"
            style={{ borderColor: "var(--color-border)" }}
          >
            <ThemeToggle />
          </li>
        </ul>

        <div className="md:hidden flex items-center gap-4">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
            aria-expanded={open}
            aria-controls="mobile-nav-panel"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-nav-panel"
          className="md:hidden border-t"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-background)",
          }}
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
