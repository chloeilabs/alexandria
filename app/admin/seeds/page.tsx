import Link from "next/link";
import { desc } from "drizzle-orm";

import { Container } from "@/components/layout/Container";
import { SeedForm } from "@/components/admin/SeedForm";
import { db } from "@/lib/db";
import { seedTopics } from "@/lib/db/schema";
import { withRetry } from "@/lib/db/retry";

export const dynamic = "force-dynamic";

export default async function AdminSeedsPage() {
  const recent = await withRetry("recentSeeds", async () =>
    db
      .select()
      .from(seedTopics)
      .orderBy(desc(seedTopics.id))
      .limit(20),
  );

  return (
    <main className="py-12">
      <Container>
        <header className="mb-8">
          <Link
            href="/admin"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-accent transition-colors"
          >
            ← Admin
          </Link>
          <h1
            className="font-display italic mt-3"
            style={{
              fontSize: 48,
              letterSpacing: "-0.015em",
              lineHeight: 1.04,
            }}
          >
            Seeds
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-2">
            Add names to the generation queue.
          </p>
        </header>

        <section className="mb-12 max-w-2xl">
          <SeedForm />
        </section>

        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
            ¶ Recent
          </h2>
          <ul className="space-y-2 font-display" style={{ fontSize: 15 }}>
            {recent.map((s) => (
              <li key={s.id} className="flex items-baseline gap-3 flex-wrap">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] w-20 text-muted-foreground">
                  {s.status}
                </span>
                <span>{s.name}</span>
                {s.hint && (
                  <span className="text-muted-foreground italic">— {s.hint}</span>
                )}
                {s.batchLabel && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {s.batchLabel}
                  </span>
                )}
              </li>
            ))}
            {recent.length === 0 && (
              <li className="text-muted-foreground italic">No seeds yet.</li>
            )}
          </ul>
        </section>
      </Container>
    </main>
  );
}
