"use client";

// Root-level error boundary. Any unhandled error in a server component
// or in fetching falls through to this. Per Next.js convention, this
// file must be a client component and accept the `reset` callback that
// re-triggers the failed render.

import { useEffect } from "react";
import Link from "next/link";
import { MonoLabel, Display } from "@/components/scriptorium/primitives";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center codex-paper">
      <div
        className="font-display"
        style={{
          fontSize: 28,
          color: "var(--color-accent)",
          letterSpacing: "0.6em",
          marginBottom: 18,
        }}
      >
        ❦
      </div>
      <MonoLabel tone="accent" size={11} track="0.32em" className="block mb-4">
        Erratum est
      </MonoLabel>
      <Display
        size={56}
        italic
        style={{
          letterSpacing: "-0.015em",
          lineHeight: 1.04,
          maxWidth: 580,
        }}
      >
        The Library lost its place.
      </Display>
      <p
        className="font-display italic"
        style={{
          fontSize: 18,
          lineHeight: 1.55,
          color: "var(--color-muted-foreground)",
          maxWidth: 480,
          margin: "24px auto 0",
        }}
      >
        Something failed while building this page. The error has been
        logged. You can try again, or follow a thread elsewhere.
      </p>

      {error.digest && (
        <MonoLabel
          size={10}
          track="0.18em"
          tone="muted"
          className="block mt-6"
        >
          ref: {error.digest}
        </MonoLabel>
      )}

      <div className="mt-10 flex items-baseline gap-8 flex-wrap justify-center">
        <button
          type="button"
          onClick={reset}
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors border-b border-accent hover:border-foreground pb-1 focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
        >
          Try again
        </button>
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-accent transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
        >
          Home
        </Link>
        <Link
          href="/random"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-accent transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
        >
          Random entry
        </Link>
      </div>
    </main>
  );
}
