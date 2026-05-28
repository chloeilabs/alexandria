export function ConsensusHistogram({
  byType,
}: {
  byType: Array<{ entityType: string; avgConsensus: number; count: number }>;
}) {
  if (!byType.length) return null;
  return (
    <div>
      <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
        ¶ Average consensus by type
      </h3>
      <ul className="space-y-2">
        {byType.map((b) => {
          const pct = Math.round(b.avgConsensus * 100);
          return (
            <li key={b.entityType} className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] w-24 text-muted-foreground">
                {b.entityType}
              </span>
              <div
                className="flex-1 h-2 relative"
                style={{ background: "var(--color-muted)" }}
                aria-hidden
              >
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${pct}%`,
                    background: "var(--color-accent)",
                  }}
                />
              </div>
              <span className="font-mono text-[11px] tabular-nums w-12 text-right">
                {pct}%
              </span>
              <span className="font-mono text-[10px] tabular-nums w-12 text-right text-muted-foreground">
                {b.count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
