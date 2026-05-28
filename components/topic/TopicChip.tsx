import Link from "next/link";

export function TopicChip({
  topic,
  count,
}: {
  topic: string;
  count?: number;
}) {
  return (
    <Link
      href={`/topic/${encodeURIComponent(topic)}`}
      className="inline-flex items-baseline gap-2 px-3 py-1 border font-mono text-[10px] uppercase tracking-[0.18em] hover:text-accent hover:border-accent transition-colors"
      style={{ borderColor: "var(--color-border)" }}
    >
      <span>{topic}</span>
      {count !== undefined && (
        <span style={{ color: "var(--color-muted-foreground)" }}>
          {count}
        </span>
      )}
    </Link>
  );
}
