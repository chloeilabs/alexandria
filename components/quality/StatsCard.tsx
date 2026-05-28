export function StatsCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div
      className="border px-5 py-4"
      style={{ borderColor: "var(--color-border)" }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p
        className="font-display italic mt-2"
        style={{ fontSize: 36, letterSpacing: "-0.015em" }}
      >
        {value}
      </p>
      {hint && (
        <p
          className="font-display italic mt-1"
          style={{
            fontSize: 13,
            color: "var(--color-muted-foreground)",
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
