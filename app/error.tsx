"use client";

import { useEffect } from "react";
import Link from "next/link";

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
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div
        aria-hidden
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
      <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-accent mb-4">
        Error
      </p>
      <h1
        className="font-display italic"
        style={{
          fontSize: 48,
          letterSpacing: "-0.015em",
          lineHeight: 1.04,
          maxWidth: 580,
        }}
      >
        The Library lost its place.
      </h1>
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
        Something failed while building this page. The error has been logged.
      </p>

      {error.digest && (
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-6">
          ref: {error.digest}
        </p>
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
      </div>
    </main>
  );
}
