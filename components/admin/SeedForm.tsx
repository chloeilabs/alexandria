"use client";

import { useState } from "react";

export function SeedForm() {
  const [text, setText] = useState("");
  const [batch, setBatch] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setStatus(null);
        try {
          const res = await fetch("/api/admin/seeds", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, batchLabel: batch || null }),
          });
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          const data = (await res.json()) as { inserted: number };
          setStatus(`Inserted ${data.inserted} seed${data.inserted === 1 ? "" : "s"}.`);
          setText("");
        } catch (err) {
          setStatus(`Error: ${(err as Error).message}`);
        } finally {
          setPending(false);
        }
      }}
      className="space-y-4"
    >
      <div>
        <label
          htmlFor="batch"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground block mb-2"
        >
          Batch label (optional)
        </label>
        <input
          id="batch"
          type="text"
          value={batch}
          onChange={(e) => setBatch(e.target.value)}
          placeholder="e.g. 2026-05-seed-1"
          className="w-full border bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
          style={{ borderColor: "var(--color-border)" }}
        />
      </div>
      <div>
        <label
          htmlFor="seeds"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground block mb-2"
        >
          Names — one per line. Optional hint after a “|”. Example:
          <br />
          <span className="text-foreground">{`Marie Curie | the chemist`}</span>
        </label>
        <textarea
          id="seeds"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          className="w-full border bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
          style={{ borderColor: "var(--color-border)" }}
          placeholder={`Marie Curie | the chemist
Mansa Musa
Songhai Empire
Murasaki Shikibu`}
        />
      </div>
      <button
        type="submit"
        disabled={pending || !text.trim()}
        className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors border-b border-accent hover:border-foreground pb-1 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Add to queue"}
      </button>
      {status && (
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {status}
        </p>
      )}
    </form>
  );
}
