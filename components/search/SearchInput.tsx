"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Suggestion {
  slug: string;
  canonicalName: string;
  entityType: string;
  shortDescription: string;
}

export function SearchInput({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const router = useRouter();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced typeahead. Hits the cheap /suggest endpoint (no embedding),
  // so firing per keystroke is fine. Aborts in-flight requests on change.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(term)}`,
          { signal: ctrl.signal },
        );
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
        setActive(-1);
        setOpen(true);
      } catch {
        /* aborted or network error — leave prior state */
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  function goFullSearch() {
    const term = q.trim();
    if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  function goEntity(s: Suggestion) {
    setOpen(false);
    router.push(`/entity/${encodeURIComponent(s.slug)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && open && suggestions.length) {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && open && suggestions.length) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && suggestions[active]) {
        e.preventDefault();
        goEntity(suggestions[active]);
      }
      // else: let the form submit → full semantic search
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goFullSearch();
        }}
        role="search"
      >
        <label htmlFor="q" className="sr-only">
          Search Alexandria
        </label>
        <input
          id="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (suggestions.length) setOpen(true);
          }}
          onBlur={() => {
            // Delay so a click on a suggestion registers before close.
            blurTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          placeholder="Search the Library — names, places, ideas…"
          className="w-full border-b-2 bg-transparent px-2 py-3 font-display italic text-2xl focus:outline-none focus:border-accent transition-colors"
          style={{
            borderColor: "var(--color-rule)",
            color: "var(--color-foreground)",
          }}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="search-suggestions"
          autoFocus
        />
      </form>

      {open && suggestions.length > 0 && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-96 overflow-auto border shadow-lg"
          style={{
            background: "var(--color-background-elevated)",
            borderColor: "var(--color-border)",
          }}
          onMouseDown={() => {
            // Keep focus/selection alive through the click.
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
        >
          {suggestions.map((s, i) => (
            <li key={s.slug} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => goEntity(s)}
                className="w-full text-left px-3 py-2.5 flex flex-col gap-0.5 transition-colors"
                style={{
                  background:
                    i === active
                      ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
                      : "transparent",
                }}
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-display italic text-base">
                    {s.canonicalName}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    {s.entityType}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {s.shortDescription}
                </span>
              </button>
            </li>
          ))}
          <li
            className="px-3 py-2 border-t font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
            style={{ borderColor: "var(--color-border)" }}
          >
            Press Enter for full semantic search ↵
          </li>
        </ul>
      )}
    </div>
  );
}
