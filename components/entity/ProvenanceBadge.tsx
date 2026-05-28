import Link from "next/link";

function scoreTone(score: number): { color: string; label: string } {
  if (score >= 0.85) return { color: "oklch(0.55 0.16 145)", label: "High" };
  if (score >= 0.6) return { color: "oklch(0.62 0.13 80)", label: "Medium" };
  return { color: "oklch(0.55 0.18 25)", label: "Low" };
}

export function ProvenanceBadge({
  consensusScore,
  generatorModel,
  verifierModel,
  compact = false,
}: {
  consensusScore: number;
  generatorModel: string;
  verifierModel: string | null;
  compact?: boolean;
}) {
  const tone = scoreTone(consensusScore);

  if (compact) {
    return (
      <span
        className="font-mono text-[10px] uppercase tracking-[0.18em] inline-flex items-baseline gap-1.5"
        style={{ color: "var(--color-muted-foreground)" }}
        title={`Consensus ${consensusScore.toFixed(2)} · ${generatorModel}${verifierModel ? ` · verified by ${verifierModel}` : ""}`}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: tone.color,
          }}
        />
        <span>AI · {consensusScore.toFixed(2)}</span>
      </span>
    );
  }

  return (
    <div
      className="border rounded-sm px-4 py-3 flex flex-wrap items-baseline gap-x-6 gap-y-1"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-background-elevated)",
      }}
      aria-label="Provenance"
    >
      <Link
        href="/about"
        className="font-mono text-[10px] uppercase tracking-[0.22em] focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
        style={{ color: tone.color }}
      >
        AI-distilled · {tone.label} confidence
      </Link>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Consensus {consensusScore.toFixed(2)}
      </span>
      <span className="font-mono text-[10px] tracking-[0.04em] text-muted-foreground">
        gen · {generatorModel}
      </span>
      {verifierModel && (
        <span className="font-mono text-[10px] tracking-[0.04em] text-muted-foreground">
          verify · {verifierModel}
        </span>
      )}
    </div>
  );
}
