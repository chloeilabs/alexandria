"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SearchInput({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = q.trim();
        if (!trimmed) return;
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      }}
      className="w-full"
      role="search"
    >
      <label
        htmlFor="q"
        className="sr-only"
      >
        Search Alexandria
      </label>
      <input
        id="q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the Library — names, places, ideas…"
        className="w-full border-b-2 bg-transparent px-2 py-3 font-display italic text-2xl focus:outline-none focus:border-accent transition-colors"
        style={{
          borderColor: "var(--color-rule)",
          color: "var(--color-foreground)",
        }}
        autoComplete="off"
        autoFocus
      />
    </form>
  );
}
