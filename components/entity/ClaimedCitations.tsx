import { CITATION_CAVEAT } from "@/lib/mcp/citation-wrap";

export interface ClaimedCitation {
  claimExcerpt: string;
  claimedSource: string;
  claimedUrl: string | null;
  claimedAuthor: string | null;
  claimKind: string;
  verifiedBySecondModel: boolean;
}

export function ClaimedCitations({ citations }: { citations: ClaimedCitation[] }) {
  if (!citations.length) {
    return (
      <section className="mt-12">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
          ¶ Claimed references
        </h2>
        <p
          className="font-display italic"
          style={{
            fontSize: 15,
            color: "var(--color-muted-foreground)",
          }}
        >
          No citations were emitted for this entry. {CITATION_CAVEAT}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-12">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
        ¶ Claimed references
      </h2>
      <p
        className="font-mono text-[10px] uppercase tracking-[0.18em] mb-4"
        style={{ color: "var(--color-warn)" }}
        role="note"
      >
        {CITATION_CAVEAT}
      </p>
      <ol className="space-y-3 list-decimal pl-5">
        {citations.map((c, i) => (
          <li key={i} className="font-display" style={{ fontSize: 15, lineHeight: 1.55 }}>
            <span className="text-foreground">{c.claimExcerpt}</span>
            <br />
            <span className="text-muted-foreground italic">
              {c.claimedAuthor ? `${c.claimedAuthor}, ` : ""}
              {c.claimedSource}
              {c.claimKind ? ` (${c.claimKind})` : ""}
              {c.claimedUrl ? (
                <>
                  {" · "}
                  <a
                    href={c.claimedUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent/80 hover:text-accent underline decoration-dotted underline-offset-2"
                  >
                    link
                  </a>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
