import Link from "next/link";

export interface FlaggedEntry {
  reviewId: number;
  entityId: string;
  slug: string;
  canonicalName: string;
  reason: string;
  severity: number;
  disagreements: Array<{ claim: string; why: string; severity: string }>;
  consensusScore: number;
}

export function ReviewList({ rows }: { rows: FlaggedEntry[] }) {
  if (!rows.length) {
    return (
      <p
        className="font-display italic"
        style={{
          fontSize: 18,
          color: "var(--color-muted-foreground)",
        }}
      >
        No items in the review queue.
      </p>
    );
  }

  return (
    <ul className="space-y-6">
      {rows.map((r) => (
        <li
          key={r.reviewId}
          className="border p-5"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <Link
                href={`/entity/${r.slug}`}
                className="font-display italic hover:text-accent transition-colors"
                style={{ fontSize: 22 }}
              >
                {r.canonicalName}
              </Link>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
                severity {r.severity} · consensus {r.consensusScore.toFixed(2)} · {r.reason}
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {r.disagreements.map((d, i) => (
              <li key={i} className="font-display" style={{ fontSize: 14 }}>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.18em] mr-2"
                  style={{
                    color:
                      d.severity === "high"
                        ? "var(--color-warn)"
                        : "var(--color-muted-foreground)",
                  }}
                >
                  {d.severity}
                </span>
                <span className="text-foreground">{d.claim}</span>{" "}
                <span className="text-muted-foreground italic">— {d.why}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
