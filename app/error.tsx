"use client";

// Root-level error boundary. Any unhandled error in a server component
// or in fetching falls through to this. Per Next.js convention, this
// file must be a client component and accept the `reset` callback that
// re-triggers the failed render.

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
    // Send to whatever observability we have. The Vercel runtime
    // already captures via @vercel/analytics + the function logs; this
    // ensures something prints in the browser console for local debug.
    console.error("Page error:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-6">
        Something went wrong
      </div>
      <h1 className="font-display font-light text-4xl md:text-5xl leading-[1.05] tracking-tight text-foreground max-w-xl">
        The Library lost its place.
      </h1>
      <p className="mt-6 font-display italic text-lg text-muted-foreground max-w-md leading-relaxed">
        Something failed while building this page. The error has been
        logged. You can try again, or follow a thread elsewhere.
      </p>

      {error.digest && (
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
          ref: {error.digest}
        </p>
      )}

      <div className="mt-10 flex items-baseline gap-8 flex-wrap justify-center">
        <button
          type="button"
          onClick={reset}
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
        >
          Try again
        </button>
        <Link
          href="/"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-accent transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
        >
          Back to the home page
        </Link>
        <Link
          href="/random"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-accent transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
        >
          Random entry
        </Link>
      </div>
    </main>
  );
}
