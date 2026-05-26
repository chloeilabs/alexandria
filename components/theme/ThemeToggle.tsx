"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

// React's documented pattern for subscribing to a value that lives
// outside of React. Avoids the setState-inside-useEffect pattern that
// triggers cascading renders (and the matching lint rule), and gets
// proper SSR handling for free via getServerSnapshot.

function subscribe(notify: () => void) {
  const obs = new MutationObserver(notify);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => obs.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  // SSR has no DOM; default to light. The no-flash script in
  // layout.tsx applies the correct class on the client before paint,
  // and the MutationObserver subscription above picks it up so the
  // button label reflects reality immediately after hydration.
  return "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    /* private-mode etc — fine */
  }
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = () => {
    applyTheme(theme === "dark" ? "light" : "dark");
  };

  const label = theme === "dark" ? "Day" : "Night";
  const glyph = theme === "dark" ? "☀" : "☾";

  // Width reservations — without these, swapping "Day" ↔ "Night"
  // shifts the surrounding nav items because the button shrinks.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      aria-pressed={theme === "dark"}
      className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-accent transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4 inline-flex items-center gap-1.5"
      suppressHydrationWarning
    >
      <span
        aria-hidden
        className="inline-block text-center"
        style={{ fontSize: 11, width: 14, letterSpacing: 0 }}
        suppressHydrationWarning
      >
        {glyph}
      </span>
      <span
        className="inline-block text-left"
        style={{ minWidth: "3.4rem" }}
        suppressHydrationWarning
      >
        {label}
      </span>
    </button>
  );
}
