#!/usr/bin/env tsx
/**
 * DB-free smoke for the three museum clients. Validates:
 *   - Met (no key): returns 0 OR valid CC0 images via tags=true.
 *     The "default-set" placeholder bug WITHOUT tags=true is exactly
 *     why we use tags=true; if Met starts returning the placeholder
 *     set here that's a regression.
 *   - Smithsonian (key-optional): silently returns [] when key absent.
 *   - Europeana (key-optional): silently returns [] when key absent.
 *
 * Exits 1 on any thrown error. Empty results are not failures — they're
 * the honest answer for entities none of the museums cover.
 */
import { searchByName } from "../lib/met";
import { searchObjects } from "../lib/smithsonian";
import { searchItems } from "../lib/europeana";

const PROBES = ["Mansa Musa", "Wu Zetian", "Akbar", "Hannibal", "Hatshepsut"];

const KNOWN_PLACEHOLDER_IDS = new Set([544320, 310453, 200668, 437261, 824771]);

async function main(): Promise<void> {
  console.log(`Museum-client smoke — ${PROBES.length} probes\n`);

  console.log(`Met (no key, broad search + name-relevance filter):`);
  let metPlaceholderRegression = false;
  for (const p of PROBES) {
    const results = await searchByName(p, { limit: 3 });
    const hitsPlaceholder = results.some((r) =>
      KNOWN_PLACEHOLDER_IDS.has(r.objectId),
    );
    if (hitsPlaceholder) metPlaceholderRegression = true;
    if (results.length === 0) {
      console.log(`  ${p.padEnd(16)} —  no Met hits (filtered out placeholders + no real matches)`);
    } else {
      console.log(`  ${p.padEnd(16)} ✓  ${results.length} hits`);
      for (const r of results.slice(0, 2)) {
        console.log(
          `    → [${r.objectId}] ${r.title.slice(0, 50)} (${r.objectDate ?? "?"}, ${r.department ?? "?"})`,
        );
      }
    }
  }
  if (metPlaceholderRegression) {
    console.log(
      "\n✗ FAIL: Met returned placeholder objectIDs — relevance filter broke.",
    );
    process.exit(1);
  }

  console.log(`\nSmithsonian (key=${process.env.SMITHSONIAN_API_KEY ? "set" : "absent"}):`);
  for (const p of PROBES) {
    const results = await searchObjects(p, { limit: 2 });
    console.log(
      `  ${p.padEnd(16)} ${results.length === 0 ? "—  empty (expected without key)" : `✓  ${results.length} hits`}`,
    );
    for (const r of results.slice(0, 1)) {
      console.log(`    → ${r.title.slice(0, 60)} (${r.unit ?? "?"})`);
    }
  }

  console.log(`\nEuropeana (key=${process.env.EUROPEANA_API_KEY ? "set" : "absent"}):`);
  for (const p of PROBES) {
    const results = await searchItems(p, { limit: 2 });
    console.log(
      `  ${p.padEnd(16)} ${results.length === 0 ? "—  empty (expected without key)" : `✓  ${results.length} hits`}`,
    );
    for (const r of results.slice(0, 1)) {
      console.log(`    → ${r.title.slice(0, 60)} (${r.dataProvider ?? "?"})`);
    }
  }

  console.log("\nDone (no errors).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
