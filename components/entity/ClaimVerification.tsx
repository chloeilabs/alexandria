import type { ClaimVerdict } from "@/lib/db/schema";

export interface ClaimRow {
  claim: string;
  verdict: ClaimVerdict;
  entropy: number;
  distinctAnswers: number;
  nSamples: number;
  majorityAnswer: string | null;
  agreesWithClaim: boolean;
}

const VERDICT: Record<
  ClaimVerdict,
  { mark: string; label: string; color: string }
> = {
  corroborated: { mark: "✓", label: "corroborated", color: "#4f9d69" },
  uncertain: { mark: "?", label: "uncertain", color: "#c08a3e" },
  contradicted: { mark: "✗", label: "contradicted", color: "#c0563e" },
};

export function ClaimVerification({
  claims,
  factualityScore,
}: {
  claims: ClaimRow[];
  factualityScore: number | null;
}) {
  if (!claims.length) return null;

  return (
    <section className="mt-12">
      <header className="flex items-baseline justify-between mb-3 flex-wrap gap-y-1">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
          ¶ Claim verification
        </h2>
        {factualityScore !== null && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {(factualityScore * 100).toFixed(0)}% corroborated
          </span>
        )}
      </header>

      <p
        className="font-display italic mb-5"
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: "var(--color-muted-foreground)",
        }}
      >
        Each atomic claim was re-tested by sampling the generator
        independently and measuring how consistently it returns the same
        fact (semantic entropy). High agreement corroborates; scattered
        answers flag possible confabulation. This is self-consistency, not
        external verification.
      </p>

      <ul className="space-y-3">
        {claims.map((c, i) => {
          const v = VERDICT[c.verdict];
          return (
            <li key={i} className="flex items-baseline gap-3">
              <span
                aria-hidden="true"
                className="font-mono text-sm"
                style={{ color: v.color, transform: "translateY(0.05em)" }}
                title={v.label}
              >
                {v.mark}
              </span>
              <div className="min-w-0">
                <p style={{ fontSize: 15, lineHeight: 1.5 }}>{c.claim}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground mt-0.5">
                  <span style={{ color: v.color }}>{v.label}</span>
                  {" · "}
                  {c.distinctAnswers}/{c.nSamples} distinct answers
                  {" · entropy "}
                  {c.entropy.toFixed(2)}
                  {c.verdict !== "corroborated" && c.majorityAnswer
                    ? ` · samples said: ${c.majorityAnswer}`
                    : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
