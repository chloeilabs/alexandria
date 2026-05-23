#!/usr/bin/env tsx
/**
 * Coverage audit (plan-mandated).
 *
 * Reports entities per (region, era) so a human can spot Western-bias
 * drift, regions falling behind, or eras that are over/underrepresented.
 * Designed to be read by hand monthly. Future work can wire its output
 * into pg-boss priority weighting so underrepresented buckets get
 * preferential ingest, but for now this is a diagnostic tool.
 *
 * Output sections:
 *   1. Era counts (5 eras)
 *   2. Civ counts (sorted ascending so thin civs are at the top)
 *   3. (Civ × Era) matrix for the top 25 civs — quick visual scan for
 *      civilizations that exist in one era but not adjacent ones.
 *   4. Tier mix per civ (so we can see which civs are mostly stubs)
 *   5. Recommended next focus (civs below the median entry count).
 *
 * Usage:
 *   pnpm tsx pipeline/audit/coverage-report.ts
 *   pnpm tsx pipeline/audit/coverage-report.ts --json   # machine-readable
 */
import "../../lib/env";
import { sql } from "drizzle-orm";

import { db } from "../../lib/db";

interface EraCount {
  era: string;
  n: number;
}

type CivCount = {
  civ: string;
  n: number;
  min_year: number | null;
  max_year: number | null;
} & Record<string, unknown>;

type MatrixCell = {
  civ: string;
  era: string;
  n: number;
} & Record<string, unknown>;

type TierMix = {
  civ: string;
  tier0: number;
  tier1: number;
  tier2: number;
  tier3: number;
} & Record<string, unknown>;

interface Report {
  generatedAt: string;
  totalEntities: number;
  eraCounts: EraCount[];
  civCounts: CivCount[];
  matrix: MatrixCell[];
  tierMix: TierMix[];
  recommendedFocus: string[];
}

async function gather(): Promise<Report> {
  const [total] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM entities
  `);

  // Note: Postgres won't let ORDER BY reference an alias here because
  // the CASE expression in the SELECT and the comparison era literal
  // confuse the resolver. Wrap in a subselect.
  const eraRows = await db.execute<{ era: string; n: number }>(sql`
    SELECT era, n FROM (
      SELECT
        CASE
          WHEN date_start < -1000 THEN 'ancient'
          WHEN date_start < 500   THEN 'classical'
          WHEN date_start < 1500  THEN 'medieval'
          WHEN date_start < 1800  THEN 'early-modern'
          WHEN date_start IS NULL THEN 'undated'
          ELSE                         'modern'
        END AS era,
        COUNT(*)::int AS n
      FROM entities
      GROUP BY 1
    ) t
    ORDER BY
      CASE t.era
        WHEN 'ancient' THEN 1
        WHEN 'classical' THEN 2
        WHEN 'medieval' THEN 3
        WHEN 'early-modern' THEN 4
        WHEN 'modern' THEN 5
        ELSE 6
      END
  `);

  const civRows = await db.execute<CivCount>(sql`
    SELECT er.region_value AS civ,
           COUNT(DISTINCT e.qid)::int AS n,
           MIN(e.date_start) AS min_year,
           MAX(e.date_start) AS max_year
    FROM entity_regions er
    JOIN entities e ON e.qid = er.entity_qid
    WHERE er.region_kind = 'civilizational'
    GROUP BY er.region_value
    ORDER BY n ASC, er.region_value ASC
  `);

  const matrixRows = await db.execute<MatrixCell>(sql`
    SELECT er.region_value AS civ,
           CASE
             WHEN e.date_start < -1000 THEN 'ancient'
             WHEN e.date_start < 500   THEN 'classical'
             WHEN e.date_start < 1500  THEN 'medieval'
             WHEN e.date_start < 1800  THEN 'early-modern'
             WHEN e.date_start IS NULL THEN 'undated'
             ELSE                         'modern'
           END AS era,
           COUNT(*)::int AS n
    FROM entity_regions er
    JOIN entities e ON e.qid = er.entity_qid
    WHERE er.region_kind = 'civilizational'
    GROUP BY er.region_value, era
  `);

  const tierRows = await db.execute<TierMix>(sql`
    SELECT er.region_value AS civ,
           COUNT(*) FILTER (WHERE e.tier = 0)::int AS tier0,
           COUNT(*) FILTER (WHERE e.tier = 1)::int AS tier1,
           COUNT(*) FILTER (WHERE e.tier = 2)::int AS tier2,
           COUNT(*) FILTER (WHERE e.tier = 3)::int AS tier3
    FROM entity_regions er
    JOIN entities e ON e.qid = er.entity_qid
    WHERE er.region_kind = 'civilizational'
    GROUP BY er.region_value
  `);

  // Recommended focus: civs with fewer entries than the median.
  const counts = Array.from(civRows).map((c) => c.n).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)] ?? 0;
  const recommendedFocus = Array.from(civRows)
    .filter((c) => c.n <= Math.max(median - 4, 3))
    .map((c) => c.civ);

  return {
    generatedAt: new Date().toISOString(),
    totalEntities: total?.n ?? 0,
    eraCounts: Array.from(eraRows),
    civCounts: Array.from(civRows),
    matrix: Array.from(matrixRows),
    tierMix: Array.from(tierRows),
    recommendedFocus,
  };
}

function fmtMatrix(report: Report): string {
  const eras = ["ancient", "classical", "medieval", "early-modern", "modern", "undated"];
  // Take the top 25 civs by entry count (descending) for the matrix —
  // a 44×6 table is hard to scan; 25×6 fits a terminal width.
  const top = report.civCounts
    .slice()
    .sort((a, b) => b.n - a.n)
    .slice(0, 25);
  const byCiv = new Map<string, Map<string, number>>();
  for (const cell of report.matrix) {
    let m = byCiv.get(cell.civ);
    if (!m) {
      m = new Map();
      byCiv.set(cell.civ, m);
    }
    m.set(cell.era, cell.n);
  }
  const header =
    "  " +
    "civ".padEnd(36) +
    eras.map((e) => e.slice(0, 8).padStart(8)).join("");
  const rows = top.map((c) => {
    const m = byCiv.get(c.civ);
    const cells = eras
      .map((e) => {
        const n = m?.get(e) ?? 0;
        return n === 0 ? "       ·" : String(n).padStart(8);
      })
      .join("");
    return "  " + c.civ.padEnd(36) + cells;
  });
  return [header, ...rows].join("\n");
}

function fmtTierMix(report: Report): string {
  // Rows where tier 0 + tier 1 > tier 2 — these civs are unfinished
  // and worth re-narrating.
  const partial = report.tierMix.filter(
    (t) => t.tier0 + t.tier1 > t.tier2 + t.tier3,
  );
  if (partial.length === 0) return "  (every civ is dominantly Tier 2+)";
  return partial
    .map(
      (t) =>
        "  " +
        t.civ.padEnd(36) +
        ("T0=" + t.tier0).padStart(6) +
        ("T1=" + t.tier1).padStart(6) +
        ("T2=" + t.tier2).padStart(6) +
        ("T3=" + t.tier3).padStart(6),
    )
    .join("\n");
}

function fmtConsole(report: Report): string {
  const lines: string[] = [];
  lines.push(`\nCoverage report — ${report.generatedAt}`);
  lines.push("=".repeat(80));
  lines.push(`Total entities: ${report.totalEntities}\n`);

  lines.push("Era counts");
  lines.push("-".repeat(40));
  for (const e of report.eraCounts) {
    lines.push(`  ${e.era.padEnd(16)} ${String(e.n).padStart(4)}`);
  }

  lines.push("\nCiv counts (thinnest first; ✱ = below recommended focus threshold)");
  lines.push("-".repeat(80));
  const focusSet = new Set(report.recommendedFocus);
  for (const c of report.civCounts) {
    const yrSpan =
      c.min_year != null && c.max_year != null
        ? `${c.min_year} to ${c.max_year}`
        : "—";
    const marker = focusSet.has(c.civ) ? "✱" : " ";
    lines.push(`  ${marker} ${String(c.n).padStart(3)}  ${c.civ.padEnd(36)} ${yrSpan}`);
  }

  lines.push("\nMatrix: top 25 civs × era (each cell = entries in that combo)");
  lines.push("-".repeat(80));
  lines.push(fmtMatrix(report));

  lines.push("\nUnfinished civs (more Tier 0/1 than Tier 2/3)");
  lines.push("-".repeat(80));
  lines.push(fmtTierMix(report));

  if (report.recommendedFocus.length > 0) {
    lines.push("\nRecommended focus for next density push");
    lines.push("-".repeat(80));
    for (const c of report.recommendedFocus) lines.push("  " + c);
  }

  lines.push("");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const json = process.argv.includes("--json");
  const report = await gather();
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(fmtConsole(report));
  }
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
