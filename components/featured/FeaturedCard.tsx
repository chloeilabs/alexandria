import Link from "next/link";
import { ProvenanceBadge } from "@/components/entity/ProvenanceBadge";
import type { EntityStub } from "@/lib/db/queries/entity";

export function FeaturedCard({ entity }: { entity: EntityStub }) {
  return (
    <Link
      href={`/entity/${entity.slug}`}
      className="block border p-5 hover:border-accent transition-colors focus:outline-none focus-visible:border-accent group"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="flex items-baseline gap-3 mb-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {entity.entityType}
        </span>
        <ProvenanceBadge
          consensusScore={entity.consensusScore}
          generatorModel=""
          verifierModel={null}
          compact
        />
      </div>
      <h3
        className="font-display italic group-hover:text-accent transition-colors"
        style={{ fontSize: 24, letterSpacing: "-0.01em" }}
      >
        {entity.canonicalName}
      </h3>
      <p
        className="font-display mt-2 line-clamp-3"
        style={{
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--color-muted-foreground)",
        }}
      >
        {entity.shortDescription}
      </p>
    </Link>
  );
}
