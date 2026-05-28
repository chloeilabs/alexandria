import Link from "next/link";

const YEAR_BUILT = "2026";

const BROWSE = [
  { href: "/search", label: "Search" },
  { href: "/browse", label: "Browse by type" },
  { href: "/quality", label: "Quality dashboard" },
  { href: "/about", label: "About / methodology" },
];

export function SiteFooter() {
  return (
    <footer
      className="border-t"
      style={{
        borderColor: "var(--color-rule)",
        borderTopWidth: 1,
        borderTopStyle: "double",
        background: "var(--color-background-elevated)",
      }}
    >
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="text-center mb-12">
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
          <Link
            href="/"
            className="font-display italic hover:text-accent transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
            style={{
              fontSize: 28,
              color: "var(--color-foreground)",
              letterSpacing: "-0.01em",
            }}
          >
            Alexandria
          </Link>
          <p
            className="font-display italic mx-auto mt-3"
            style={{
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--color-muted-foreground)",
              maxWidth: 520,
            }}
          >
            An AI-distilled knowledge base. Designed for AI tool calling;
            readable by humans.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-10 gap-x-12">
          <nav aria-label="Footer navigation">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-4">
              ¶ Browse
            </h2>
            <ul className="space-y-2 font-display text-base text-muted-foreground">
              {BROWSE.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="hover:text-accent transition-colors focus:outline-none focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-4">
              ¶ Provenance
            </h2>
            <p
              className="font-display italic"
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                color: "var(--color-muted-foreground)",
              }}
            >
              Every entry is AI-distilled. Citations are LLM-claimed and{" "}
              <em>not</em> externally verified. See{" "}
              <Link
                href="/about"
                className="text-accent/80 hover:text-accent transition-colors underline decoration-dotted underline-offset-2"
              >
                methodology
              </Link>
              .
            </p>
          </div>

          <div>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-4">
              ¶ For AI agents
            </h2>
            <p
              className="font-display italic"
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                color: "var(--color-muted-foreground)",
              }}
            >
              MCP endpoint at{" "}
              <code
                className="font-mono"
                style={{
                  fontSize: 13,
                  color: "var(--color-foreground)",
                }}
              >
                /api/mcp
              </code>
              . Configure as a Streamable-HTTP MCP server.
            </p>
          </div>
        </div>
      </div>

      <div
        className="border-t"
        style={{ borderColor: "var(--color-border-faint)" }}
      >
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-baseline justify-between flex-wrap gap-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
            Alexandria · MMXXVI
          </span>
          <span
            className="font-display italic"
            style={{
              fontSize: 14,
              color: "var(--color-muted-foreground)",
              opacity: 0.7,
            }}
          >
            Built {YEAR_BUILT}
          </span>
        </div>
      </div>
    </footer>
  );
}
