#!/usr/bin/env tsx
/**
 * DB-free WHG client smoke. Probes a non-Western-heavy mix of historical
 * places; expects at least one variant on most of them (the whole reason
 * we're integrating WHG). Exits non-zero on errors or if 0 of the probes
 * returned ANY hits — that would indicate a UA/bot-filter regression.
 */
import { searchByName } from "../lib/whg";

const PROBES = [
  "Persepolis",
  "Tenochtitlan",
  "Cuzco",
  "Tikal",
  "Carthage",
  "Songhai",
  "Mecca",
  "Mali",
];

async function main(): Promise<void> {
  console.log(`WHG index-API smoke — ${PROBES.length} probes\n`);
  let errors = 0;
  let totalHits = 0;
  let variantsSeen = 0;

  for (const p of PROBES) {
    try {
      const results = await searchByName(p, { limit: 3 });
      totalHits += results.length;
      const allVariants = new Set<string>();
      for (const r of results) for (const v of r.variants) allVariants.add(v);
      variantsSeen += allVariants.size;
      const top = results[0];
      if (!top) {
        console.log(`  ${p.padEnd(14)} —  no WHG matches`);
        continue;
      }
      const variantPreview =
        allVariants.size > 0
          ? `[${Array.from(allVariants).slice(0, 3).join(", ")}${allVariants.size > 3 ? "…" : ""}]`
          : "(no variants)";
      console.log(
        `  ${p.padEnd(14)} ✓  ${results.length} hits, top "${top.title}" score=${top.score.toFixed(1)}, ${allVariants.size} variants ${variantPreview}`,
      );
    } catch (err) {
      errors += 1;
      console.log(
        `  ${p.padEnd(14)} ✗  ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    `\nTotal: ${totalHits} hits across probes · ${variantsSeen} distinct variants · ${errors} errors`,
  );
  if (errors > 0 || totalHits === 0) {
    console.log("\n✗ FAIL");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
