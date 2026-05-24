#!/usr/bin/env tsx
/**
 * Direct smoke test of the IA client — no DB, no AI Gateway. Calls
 * fetchInternetArchive against a curated mix of entities that should
 * exercise different code paths:
 *
 *   - Classical/European (expected hit): Hannibal, Cleopatra, Charlemagne
 *   - Non-Western post-Britannica (expected miss in English-only MVP):
 *       Mansa Musa, Wu Zetian, Túpac Amaru II
 *   - Place vs person disambiguation: Hannibal (should NOT match
 *     "History of Jasper County, Missouri" thanks to the local-history
 *     penalty)
 *
 * Run:   pnpm tsx scripts/smoke-ia-client.ts
 */
import { fetchInternetArchive, type EntityHintType } from "../lib/internet-archive";

interface Probe {
  name: string;
  type: EntityHintType;
  expectation: "hit" | "miss-acceptable";
  note?: string;
}

const PROBES: Probe[] = [
  { name: "Hannibal", type: "person", expectation: "hit", note: "Carthaginian general — strong pre-1924 English coverage; also tests local-history penalty" },
  { name: "Cleopatra", type: "person", expectation: "hit", note: "well-covered classical figure" },
  { name: "Charlemagne", type: "person", expectation: "hit", note: "European medieval" },
  { name: "Mansa Musa", type: "person", expectation: "miss-acceptable", note: "non-Western, post-Britannica — IA English corpus likely sparse" },
  { name: "Wu Zetian", type: "person", expectation: "miss-acceptable", note: "Chinese imperial — non-Western" },
  { name: "Akbar", type: "person", expectation: "miss-acceptable", note: "Mughal — non-Western, but may have orientalist coverage" },
  { name: "Carthage", type: "place", expectation: "hit", note: "place type, classical" },
];

async function main(): Promise<void> {
  console.log(`Direct IA-client smoke test — ${PROBES.length} probes\n`);
  let hits = 0;
  let misses = 0;
  let errors = 0;
  let expectedHitMatches = 0;
  let unexpectedMisses = 0;
  for (const p of PROBES) {
    const t0 = Date.now();
    let result;
    try {
      result = await fetchInternetArchive(p.name, p.type);
    } catch (err) {
      errors += 1;
      console.log(
        `  ${p.name.padEnd(16)} ${p.type.padEnd(8)}  ✗  ERROR: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }
    const dt = Date.now() - t0;
    if (result) {
      hits += 1;
      if (p.expectation === "hit") expectedHitMatches += 1;
      const yr = result.year ?? "?";
      const who = result.creator?.slice(0, 28) ?? "";
      console.log(
        `  ${p.name.padEnd(16)} ${p.type.padEnd(8)}  ✓  ${dt}ms  ` +
          `${result.text.length.toString().padStart(5)}c  ${result.title.slice(0, 38)} [${who}, ${yr}]`,
      );
      // Show first 200 chars of extracted text so we can eyeball OCR quality.
      console.log(`      → ${result.text.slice(0, 180).replace(/\s+/g, " ").trim()}…\n`);
    } else {
      misses += 1;
      if (p.expectation === "hit") unexpectedMisses += 1;
      const tag = p.expectation === "miss-acceptable" ? "—  miss (acceptable)" : "—  MISS (unexpected)";
      console.log(`  ${p.name.padEnd(16)} ${p.type.padEnd(8)}  ${tag}  ${dt}ms`);
      console.log(`      ${p.note ?? ""}\n`);
    }
  }
  console.log(
    `\nResult: ${hits} hit · ${misses} miss · ${errors} error out of ${PROBES.length} probes.`,
  );
  const expectedHits = PROBES.filter((p) => p.expectation === "hit").length;
  console.log(
    `Of ${expectedHits} probes where a hit was expected, ${expectedHitMatches}/${expectedHits} hit.`,
  );
  if (unexpectedMisses > 0 || errors > 0) {
    console.log(
      `\n✗ FAIL: ${unexpectedMisses} expected hits missed, ${errors} errors.`,
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
