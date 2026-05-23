import Link from "next/link";
import { getAllEntitySlugs } from "@/lib/db/queries/entity";

function fmtYear(year: number | null, precision: string | null): string {
  if (year == null) return "";
  const era = year < 0 ? "BCE" : "CE";
  const y = Math.abs(year);
  if (precision === "decade") return `${y}s ${era}`;
  return `${y} ${era}`;
}

export default async function Home() {
  const entities = await getAllEntitySlugs(60);
  const hasContent = entities.length > 0;

  return (
    <main className="min-h-screen">
      <section className="max-w-3xl mx-auto px-6 pt-32 pb-20">
        <h1 className="font-display font-light text-6xl md:text-7xl leading-none tracking-tight text-foreground">
          The Library of Alexandria
        </h1>
        <p className="mt-6 font-display italic text-2xl text-muted-foreground max-w-xl">
          A living digital encyclopedia of human civilization. Begin anywhere;
          follow the threads.
        </p>
        <div className="mt-10 flex items-baseline gap-8">
          <Link
            href="/search"
            className="font-mono text-xs uppercase tracking-[0.2em] text-accent hover:text-foreground transition-colors"
          >
            Search →
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {hasContent
              ? `${entities.length} entries seeded`
              : "Awaiting the seed"}
          </span>
        </div>
      </section>

      {hasContent && (
        <section className="max-w-3xl mx-auto px-6 pb-32">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-8">
            Available entries
          </h2>
          <ul className="divide-y divide-border">
            {entities.map((e) => (
              <li
                key={e.slug}
                className="py-5 flex items-baseline justify-between gap-6"
              >
                <Link
                  href={`/entity/${e.slug}`}
                  className="font-display text-2xl text-foreground hover:text-accent transition-colors flex-1 truncate"
                >
                  {e.name}
                </Link>
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {e.type}
                  {e.dateStart != null
                    ? `  ·  ${fmtYear(e.dateStart, null)}`
                    : ""}
                  {e.tier >= 1 ? `  ·  T${e.tier}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
