import { CITATION_CAVEAT } from "@/lib/mcp/citation-wrap";

export interface ClaimedCitation {
  claimExcerpt: string;
  claimedSource: string;
  claimedUrl: string | null;
  claimedAuthor: string | null;
  claimKind: string;
  verifiedBySecondModel: boolean;
  resolutionStatus: string;
  resolvedDoi: string | null;
  resolvedUrl: string | null;
}

const RESOLUTION: Record<
  string,
  { mark: string; label: string; color: string } | undefined
> = {
  verified: { mark: "✓", label: "resolves to a real work", color: "#4f9d69" },
  ambiguous: { mark: "~", label: "possible match", color: "#c08a3e" },
  not_found: { mark: "", label: "", color: "" },
  unchecked: { mark: "", label: "", color: "" },
};

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

  const verified = citations.filter(
    (c) => c.resolutionStatus === "verified",
  ).length;
  const checked = citations.filter(
    (c) => c.resolutionStatus !== "unchecked",
  ).length;

  return (
    <section className="mt-12">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
        ¶ Claimed references
      </h2>
      <p
        className="font-mono text-[10px] uppercase tracking-[0.18em] mb-1"
        style={{ color: "var(--color-warn)" }}
        role="note"
      >
        {CITATION_CAVEAT}
      </p>
      {checked > 0 && (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-4">
          {verified} of {citations.length} resolve to a real work in
          CrossRef/OpenAlex (confirms the work exists, not that it is cited
          accurately).
        </p>
      )}
      <ol className="space-y-3 list-decimal pl-5">
        {citations.map((c, i) => {
          const r = RESOLUTION[c.resolutionStatus];
          const href = c.resolvedUrl ?? c.claimedUrl;
          return (
            <li
              key={i}
              className="font-display"
              style={{ fontSize: 15, lineHeight: 1.55 }}
            >
              <span className="text-foreground">{c.claimExcerpt}</span>
              <br />
              <span className="text-muted-foreground italic">
                {r?.mark ? (
                  <span
                    aria-hidden="true"
                    className="not-italic font-mono"
                    style={{ color: r.color }}
                    title={r.label}
                  >
                    {r.mark}{" "}
                  </span>
                ) : null}
                {c.claimedAuthor ? `${c.claimedAuthor}, ` : ""}
                {c.claimedSource}
                {c.claimKind ? ` (${c.claimKind})` : ""}
                {c.resolvedDoi ? (
                  <>
                    {" · "}
                    <a
                      href={`https://doi.org/${c.resolvedDoi}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-mono text-[11px] text-accent/80 hover:text-accent underline decoration-dotted underline-offset-2"
                    >
                      doi:{c.resolvedDoi}
                    </a>
                  </>
                ) : href ? (
                  <>
                    {" · "}
                    <a
                      href={href}
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
          );
        })}
      </ol>
    </section>
  );
}
