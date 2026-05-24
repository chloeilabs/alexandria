"use client";

// Search input with type-ahead suggestions. Replaces the bare <input>
// on /search. Sits inside the same <form> so Enter without an active
// suggestion still navigates to /search?q=... (full search page);
// Enter with an active suggestion navigates to that entity directly.
//
// Keyboard model:
//   - ↑/↓ moves the active highlight (with wrap)
//   - Enter on active: navigate to entity
//   - Enter without active: submit form (normal search)
//   - Esc: close dropdown, return focus to input
//   - Tab: close dropdown, default tab behavior

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtYear } from "@/lib/format";

interface SuggestHit {
  qid: string;
  slug: string;
  name: string;
  type: string;
  tier: number;
  dateStart: number | null;
  dateStartPrecision: string | null;
}

interface Props {
  /** Initial query value (when arriving with ?q=…). */
  initialQuery: string;
}

const DEBOUNCE_MS = 180;
const MIN_QUERY_LEN = 2;

export function SearchAutocomplete({ initialQuery }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [hits, setHits] = useState<SuggestHit[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = "search-suggest-list";

  // Debounced fetch on value change. State writes happen inside the
  // setTimeout callback (and a final cleanup synchronously clears via
  // a cancel flag) so we don't synchronously setState inside the effect
  // body — the React hooks rule treats that as a render trigger.
  useEffect(() => {
    let aborted = false;
    const v = value.trim();
    const t = setTimeout(async () => {
      if (aborted) return;
      if (v.length < MIN_QUERY_LEN) {
        setHits([]);
        setOpen(false);
        setLoading(false);
        setActive(-1);
        return;
      }
      setLoading(true);
      try {
        const r = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(v)}&limit=8`,
          { headers: { Accept: "application/json" } },
        );
        if (!r.ok || aborted) return;
        const data = (await r.json()) as { hits: SuggestHit[] };
        if (aborted) return;
        setHits(data.hits);
        setOpen(data.hits.length > 0);
        setActive(-1);
      } catch {
        // Network error — silently degrade; the form still submits.
      } finally {
        if (!aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      aborted = true;
      clearTimeout(t);
    };
  }, [value]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || hits.length === 0) {
      // Plain submit path — the wrapping <form> takes over.
      if (e.key === "Escape") {
        setOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? hits.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (active >= 0 && active < hits.length) {
        e.preventDefault();
        const hit = hits[active]!;
        setOpen(false);
        router.push(`/entity/${hit.slug}`);
      }
      // else: let the form submit
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Tab") {
      // Tab out: close the dropdown so it doesn't visually overlap
      // whatever the user tabs to next.
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id="q"
        name="q"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          if (hits.length > 0) setOpen(true);
        }}
        onBlur={() => {
          // Delay so the click on a suggestion can register before we
          // tear down the list.
          setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search the Library…"
        autoFocus
        autoComplete="off"
        spellCheck="false"
        inputMode="search"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          active >= 0 ? `search-suggest-${active}` : undefined
        }
        className="w-full bg-transparent border-b border-border px-0 py-4 text-3xl md:text-4xl font-display font-light focus:outline-none focus:border-accent text-foreground placeholder:text-muted-foreground/60 transition-colors"
      />

      {open && hits.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-full mt-2 z-10 bg-background border border-border shadow-lg max-h-[60vh] overflow-y-auto"
        >
          {hits.map((h, i) => {
            const isActive = i === active;
            return (
              <li
                key={h.qid}
                id={`search-suggest-${i}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  // mousedown fires before blur — navigate manually
                  // before the input's onBlur closes the panel.
                  e.preventDefault();
                  setOpen(false);
                  router.push(`/entity/${h.slug}`);
                }}
                className={
                  "px-5 py-3 cursor-pointer flex items-baseline gap-4 flex-wrap " +
                  (isActive
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:bg-card/60")
                }
              >
                <span
                  className={
                    "font-display text-xl " +
                    (isActive ? "text-foreground" : "text-foreground/85")
                  }
                >
                  {h.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
                  {h.type}
                  {h.dateStart != null
                    ? `  ·  ${fmtYear(h.dateStart, h.dateStartPrecision)}`
                    : ""}
                  {h.tier >= 3 ? "  ·  Tier 3" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Live region for screen readers — announces match count when the
          dropdown updates so non-visual users know suggestions appeared. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {loading
          ? "Searching…"
          : open && hits.length > 0
            ? `${hits.length} suggestion${hits.length === 1 ? "" : "s"} available. Use up and down arrows to navigate.`
            : ""}
      </div>
    </div>
  );
}
