#!/usr/bin/env tsx
/**
 * DB-free smoke for the Europeana client. Validates that the key-gated
 * client silently returns [] without a key, returns relevant CC items
 * with a key, and never throws.
 *
 * Met and Smithsonian were removed on 2026-05-24 to limit the API
 * surface; this used to probe all three.
 *
 * Exits 1 on any thrown error. Empty results are not failures — they're
 * the honest answer for entities Europeana doesn't cover.
 */
import { searchItems } from "../lib/europeana";

const PROBES = ["Mansa Musa", "Wu Zetian", "Akbar", "Hannibal", "Hatshepsut"];

async function main(): Promise<void> {
  console.log(
    `Europeana smoke — ${PROBES.length} probes (key=${process.env.EUROPEANA_API_KEY ? "set" : "absent"})\n`,
  );
  for (const p of PROBES) {
    const results = await searchItems(p, { limit: 2 });
    console.log(
      `  ${p.padEnd(16)} ${results.length === 0 ? "—  empty" : `✓  ${results.length} hits`}`,
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
