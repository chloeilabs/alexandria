#!/usr/bin/env tsx
/**
 * Promote unique-base slugs from "julius-caesar-q1048" → "julius-caesar".
 *
 * Algorithm: compute the base slug for every entity, count collisions, then
 * for each entity:
 *   - if its base slug is unique across the corpus  → use the bare form
 *   - if multiple entities share a base slug         → keep the QID-suffix
 *   - if the base slug is empty (pure non-Latin)     → fall back to QID
 *
 * Idempotent — running twice produces the same final state. Safe to run
 * after any seed/enrich batch.
 */
import "../lib/env";
import { eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { entities } from "../lib/db/schema";
import { baseSlug } from "../pipeline/bulk/wikidata";

async function main(): Promise<void> {
  const rows = await db
    .select({ qid: entities.qid, name: entities.name, slug: entities.slug })
    .from(entities);

  // Compute base slug per QID and count occurrences.
  const baseByQid = new Map<string, string>();
  const collisionCount = new Map<string, number>();

  for (const r of rows) {
    const base = baseSlug(r.name);
    baseByQid.set(r.qid, base);
    if (base) collisionCount.set(base, (collisionCount.get(base) ?? 0) + 1);
  }

  let changed = 0;
  let keptSuffixed = 0;
  let keptBare = 0;

  for (const r of rows) {
    const base = baseByQid.get(r.qid)!;
    const count = base ? collisionCount.get(base) ?? 0 : 0;
    const finalSlug = !base
      ? r.qid.toLowerCase()
      : count > 1
        ? `${base}-${r.qid.toLowerCase()}`
        : base;

    if (finalSlug === r.slug) {
      if (finalSlug === base) keptBare += 1;
      else keptSuffixed += 1;
      continue;
    }

    await db
      .update(entities)
      .set({ slug: finalSlug })
      .where(eq(entities.qid, r.qid));
    changed += 1;
    process.stdout.write(
      `  ${r.qid.padEnd(10)} ${r.slug.padEnd(40)} → ${finalSlug}\n`,
    );
  }

  // Report collisions for transparency
  const collisions = [...collisionCount.entries()].filter(([, n]) => n > 1);
  console.log(
    `\n${changed} slugs changed  ·  ${keptBare} already-bare  ·  ${keptSuffixed} kept QID-suffix`,
  );
  if (collisions.length > 0) {
    console.log(`\nCollisions kept as -qid:`);
    for (const [base, n] of collisions) {
      console.log(`  ${base} × ${n}`);
    }
  }

  await db.execute(sql`SELECT 1`); // sanity ping
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
