import { FeaturedCard } from "./FeaturedCard";
import type { EntityStub } from "@/lib/db/queries/entity";

export function FeaturedRow({ entities }: { entities: EntityStub[] }) {
  if (!entities.length) {
    return (
      <p
        className="font-display italic"
        style={{
          fontSize: 18,
          color: "var(--color-muted-foreground)",
        }}
      >
        No featured entries yet — the corpus is still being seeded.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {entities.map((e) => (
        <li key={e.id}>
          <FeaturedCard entity={e} />
        </li>
      ))}
    </ul>
  );
}
