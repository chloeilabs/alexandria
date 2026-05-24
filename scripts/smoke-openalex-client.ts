#!/usr/bin/env tsx
/**
 * DB-free smoke for lib/openalex. Exercises searchWorks + corroborateClaim
 * against a curated mix of plausible Tier-2 fact-check findings:
 *
 *   - Strong-corroboration claim (Mansa Musa hajj 1324): expected
 *     "strong" signal — the scholarly literature is rich.
 *   - Partial-corroboration claim (Wu Zetian Buddhism): some works,
 *     fewer high-citation hits.
 *   - Weak-corroboration claim (made-up specific): expected "weak".
 *
 * Exits 1 if any expected-strong claim returns weak (regression
 * indicator).
 */
import {
  searchWorks,
  corroborateClaim,
} from "../lib/openalex";

interface Probe {
  entity: string;
  claim: string;
  expect: "strong" | "partial" | "weak";
}

const PROBES: Probe[] = [
  {
    entity: "Mansa Musa",
    claim: "Mansa Musa's 1324 pilgrimage to Mecca distributed so much gold that the price of bullion in Cairo collapsed for over a decade.",
    expect: "strong",
  },
  {
    entity: "Wu Zetian",
    claim: "Wu Zetian was a major patron of Buddhism during the Zhou dynasty.",
    expect: "partial",
  },
  {
    entity: "Akbar",
    claim: "Akbar the Mughal emperor convened multifaith debates in the Ibadat Khana at Fatehpur Sikri.",
    expect: "partial",
  },
  {
    entity: "Hannibal",
    claim: "Hannibal Barca crossed the Alps with elephants during the Second Punic War.",
    expect: "strong",
  },
];

async function main(): Promise<void> {
  console.log(`OpenAlex client smoke — ${PROBES.length} probes\n`);
  let unexpectedRegressions = 0;
  let errors = 0;

  // First: confirm the basic search works.
  console.log("Basic search smoke (no key):");
  const works = await searchWorks("mansa musa", { limit: 2 });
  console.log(`  Returned ${works.length} works for "mansa musa"`);
  for (const w of works) {
    console.log(
      `    - ${w.title.slice(0, 70).padEnd(70)} (${w.year ?? "?"}, cited ${w.citedByCount}x)`,
    );
  }
  console.log();

  // Corroboration probes.
  for (const p of PROBES) {
    const t0 = Date.now();
    try {
      const c = await corroborateClaim(p.entity, p.claim, { limit: 3 });
      const dt = Date.now() - t0;
      const regressed = p.expect === "strong" && c.signal === "weak";
      if (regressed) unexpectedRegressions += 1;
      const tag = regressed ? "✗ regression" : c.signal === p.expect ? "✓" : "·";
      console.log(
        `  ${tag} [${c.signal.padEnd(7)}] expected=${p.expect.padEnd(7)} ` +
          `${dt}ms · ${p.entity} — "${p.claim.slice(0, 50)}…"`,
      );
      for (const w of c.topWorks.slice(0, 2)) {
        console.log(
          `      ↳ ${w.title.slice(0, 70)} (${w.year ?? "?"}, ${w.citedByCount}x)`,
        );
      }
    } catch (err) {
      errors += 1;
      console.log(
        `  ✗ ERROR · ${p.entity}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    `\nResult: ${PROBES.length - unexpectedRegressions - errors}/${PROBES.length} ok · ${unexpectedRegressions} regressions · ${errors} errors`,
  );

  if (unexpectedRegressions > 0 || errors > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
