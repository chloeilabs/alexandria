import Link from "next/link";
import { ProvenanceBadge } from "./ProvenanceBadge";

export interface RelatedRow {
  predicate: string;
  entity: {
    id: string;
    slug: string;
    canonicalName: string;
    entityType: string;
    shortDescription: string;
    consensusScore: number;
  };
}

function humanizePredicate(p: string): string {
  return p.replace(/_/g, " ");
}

export function RelatedPanel({ related }: { related: RelatedRow[] }) {
  if (!related.length) return null;
  const grouped = related.reduce<Record<string, RelatedRow[]>>((acc, r) => {
    (acc[r.predicate] ??= []).push(r);
    return acc;
  }, {});

  return (
    <aside
      className="border-l pl-6 space-y-6"
      style={{ borderColor: "var(--color-border-faint)" }}
      aria-label="Related entities"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
        ¶ Related
      </h2>
      {Object.entries(grouped).map(([predicate, rows]) => (
        <div key={predicate}>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            {humanizePredicate(predicate)}
          </p>
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.entity.id}>
                <Link
                  href={`/entity/${r.entity.slug}`}
                  className="block hover:text-accent transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
                >
                  <span className="font-display italic" style={{ fontSize: 17 }}>
                    {r.entity.canonicalName}
                  </span>
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.14em] ml-2"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    {r.entity.entityType}
                  </span>
                </Link>
                <p
                  className="font-display mt-0.5 line-clamp-2"
                  style={{
                    fontSize: 13,
                    color: "var(--color-muted-foreground)",
                  }}
                >
                  {r.entity.shortDescription}
                </p>
                <div className="mt-1">
                  <ProvenanceBadge
                    consensusScore={r.entity.consensusScore}
                    generatorModel=""
                    verifierModel={null}
                    compact
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}
