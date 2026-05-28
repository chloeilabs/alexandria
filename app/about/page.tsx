import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "About · Alexandria",
};

export default function AboutPage() {
  return (
    <main className="py-12">
      <Container>
        <header className="mb-10 max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
            ¶ Methodology
          </p>
          <h1
            className="font-display italic"
            style={{
              fontSize: 48,
              letterSpacing: "-0.015em",
              lineHeight: 1.04,
            }}
          >
            How Alexandria is made.
          </h1>
        </header>

        <article
          className="max-w-3xl space-y-6 font-display"
          style={{ fontSize: 18, lineHeight: 1.72 }}
        >
          <p>
            Alexandria is an{" "}
            <em>AI-distilled secondary reference layer</em>, designed for
            AI agents to call as a tool. Each entry is synthesized by a
            language model from its own training knowledge — not pulled
            from a third-party source. There is no Wikipedia, Wikidata,
            or scholarly database behind it.
          </p>
          <p>
            That has real consequences. The library is a reflection of
            what the underlying models believe, including their blind
            spots, anachronisms, and occasional confabulations. It is{" "}
            <strong>not</strong> an encyclopedia in the traditional sense,
            and citations are not sources. We label them <em>claimed
            references</em> precisely because we don&apos;t follow them out to
            a primary text — the model says it came from somewhere; we
            faithfully record the claim and pass that uncertainty on.
          </p>

          <h2
            className="font-display italic mt-10"
            style={{
              fontSize: 28,
              letterSpacing: "-0.01em",
            }}
          >
            Consensus, not truth.
          </h2>
          <p>
            Every entry goes through two model passes: a generator and a
            verifier (currently the same model in a fresh context — same
            family, no shared state). The verifier returns a list of
            disagreements, each scored low / medium / high severity. A
            consensus score is derived from those:
          </p>
          <pre
            className="font-mono"
            style={{
              fontSize: 13,
              background: "var(--color-background-elevated)",
              padding: "1rem",
              borderLeft: "3px solid var(--color-accent)",
            }}
          >
            {`score = 1 − (high × 0.3 + medium × 0.1), clamped to [0, 1]`}
          </pre>
          <p>
            Anything with a high-severity disagreement, or a score below{" "}
            <code>0.5</code>, is flagged and goes to a review queue. The
            rest publishes automatically. This is not strong grounding —
            two passes from the same model family share training data and
            can hallucinate together — but it catches a useful fraction
            of overconfident assertions without external lookups.
          </p>

          <h2
            className="font-display italic mt-10"
            style={{
              fontSize: 28,
              letterSpacing: "-0.01em",
            }}
          >
            Provenance, foregrounded.
          </h2>
          <p>
            On every entity page, the band beneath the title shows the
            consensus score, the model that generated the entry, and the
            model that verified it. In MCP tool responses, every payload
            includes an inline caveat string. There is no view, code path,
            or tool call that returns Alexandria content without
            announcing what it is.
          </p>

          <h2
            className="font-display italic mt-10"
            style={{
              fontSize: 28,
              letterSpacing: "-0.01em",
            }}
          >
            For AI agents.
          </h2>
          <p>
            The Streamable-HTTP MCP endpoint is at{" "}
            <code className="font-mono">/api/mcp</code>. Tools include{" "}
            <code className="font-mono">search_entities</code>,{" "}
            <code className="font-mono">get_entity</code>,{" "}
            <code className="font-mono">get_related</code>,{" "}
            <code className="font-mono">list_by_type</code>,{" "}
            <code className="font-mono">list_by_topic</code>,{" "}
            <code className="font-mono">list_by_date_range</code>, and{" "}
            <code className="font-mono">get_citations</code>. Tool
            descriptions are the actual product surface; we iterate on
            them as agents call them.
          </p>

          <h2
            className="font-display italic mt-10"
            style={{
              fontSize: 28,
              letterSpacing: "-0.01em",
            }}
          >
            What this isn&apos;t.
          </h2>
          <p>
            Not authoritative. Not a primary source. Not a replacement
            for a reference librarian or a peer-reviewed article. Treat
            anything here the way you&apos;d treat a confident answer from a
            single model — useful as a starting point, never as the final
            word. See the live{" "}
            <Link
              href="/quality"
              className="text-accent underline decoration-dotted underline-offset-4 hover:text-foreground"
            >
              quality dashboard
            </Link>{" "}
            for current consensus distribution and flagged-entry counts.
          </p>
        </article>
      </Container>
    </main>
  );
}
