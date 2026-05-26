import Link from "next/link";
import { MonoLabel, Display } from "@/components/scriptorium/primitives";

export default function NotFound() {
  return (
    <main className="min-h-[calc(100vh-3rem)] flex items-center justify-center px-6 codex-paper">
      <div className="text-center max-w-lg">
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
          IV · 404 · perditus
        </MonoLabel>
        <Display
          size={56}
          italic
          style={{ letterSpacing: "-0.015em", lineHeight: 1.04 }}
        >
          The Library is silent here.
        </Display>
        <p
          className="font-display italic mt-6"
          style={{
            fontSize: 18,
            lineHeight: 1.55,
            color: "var(--color-muted-foreground)",
            margin: "24px 0 32px",
          }}
        >
          This entry has not yet been written, or you took a wrong turn
          in the stacks. Begin again from the index.
        </p>
        <div className="flex items-baseline gap-8 flex-wrap justify-center">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors border-b border-accent hover:border-foreground pb-1"
          >
            Return to the Library
          </Link>
          <Link
            href="/random"
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-accent transition-colors"
          >
            Random entry →
          </Link>
        </div>
      </div>
    </main>
  );
}
