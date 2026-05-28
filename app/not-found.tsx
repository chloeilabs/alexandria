import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-[calc(100vh-3rem)] flex items-center justify-center px-6">
      <div className="text-center max-w-lg">
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
          404 · Not found
        </p>
        <h1
          className="font-display italic"
          style={{
            fontSize: 48,
            letterSpacing: "-0.015em",
            lineHeight: 1.04,
          }}
        >
          The Library is silent here.
        </h1>
        <p
          className="font-display italic mt-6"
          style={{
            fontSize: 18,
            lineHeight: 1.55,
            color: "var(--color-muted-foreground)",
            margin: "24px 0 32px",
          }}
        >
          This entry has not been generated, or you took a wrong turn.
        </p>
        <div className="flex items-baseline gap-8 flex-wrap justify-center">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors border-b border-accent hover:border-foreground pb-1"
          >
            Return to the Library
          </Link>
          <Link
            href="/search"
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-accent transition-colors"
          >
            Search →
          </Link>
        </div>
      </div>
    </main>
  );
}
