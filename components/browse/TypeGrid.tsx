import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  person: "People",
  place: "Places",
  event: "Events",
  concept: "Concepts",
  work: "Works",
  organization: "Organizations",
  species: "Species",
  artifact: "Artifacts",
  other: "Other",
};

export function TypeGrid({
  counts,
}: {
  counts: Array<{ entityType: string; count: number }>;
}) {
  if (!counts.length) {
    return (
      <p
        className="font-display italic"
        style={{
          fontSize: 18,
          color: "var(--color-muted-foreground)",
        }}
      >
        No entries have been published yet.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {counts.map((c) => (
        <li key={c.entityType}>
          <Link
            href={`/browse/${c.entityType}`}
            className="block border px-5 py-4 hover:border-accent hover:text-accent transition-colors focus:outline-none focus-visible:border-accent"
            style={{ borderColor: "var(--color-border)" }}
          >
            <p
              className="font-display italic"
              style={{ fontSize: 22, letterSpacing: "-0.01em" }}
            >
              {TYPE_LABELS[c.entityType] ?? c.entityType}
            </p>
            <p
              className="font-mono text-[10px] uppercase tracking-[0.22em] mt-1"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              {c.count} {c.count === 1 ? "entry" : "entries"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
