export function ModelCoverage({
  coverage,
}: {
  coverage: Array<{ model: string; count: number }>;
}) {
  if (!coverage.length) return null;
  return (
    <div>
      <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
        ¶ Generator coverage
      </h3>
      <ul className="space-y-1.5 font-display" style={{ fontSize: 15 }}>
        {coverage.map((c) => (
          <li key={c.model} className="flex justify-between gap-3">
            <span className="text-foreground">{c.model}</span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {c.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
