#!/usr/bin/env tsx
/**
 * Voice-lock calibration. Re-narrates a fixed set of "anchor" entities
 * using the current model + prompt, side-by-side with the existing
 * curated narrative in the DB. Read-only — never writes back.
 *
 * Anchor set = 10 hand-picked Tier 3 references (Hannibal, Mansa Musa,
 * Wu Zetian, Tupac Amaru II, Hatshepsut, Saladin, Murasaki Shikibu,
 * Akbar, Songhai Empire, Battle of Tondibi) UNION one representative
 * per civilizational tag (~47 civs → ~57 total).
 *
 * Run before scaling. Writes a Markdown report to
 * `calibration-voice-lock.md` with the existing vs candidate narratives
 * side-by-side. Reject and tune `lib/ai/prompts/narrate.ts` if any of
 * the rules fail:
 *   - Wikipedia-flat opening ("X was a Y who…")
 *   - Western-default framing on non-Western subjects
 *   - BC/AD instead of BCE/CE
 *
 * Cost: ~50 narrate calls × ~$0.02 ≈ $1.00.
 */
import "../lib/env";
import { generateText } from "ai";
import { eq, sql } from "drizzle-orm";
import { writeFile } from "node:fs/promises";

import { db } from "../lib/db";
import { entities, sources as sourcesTable } from "../lib/db/schema";
import { MODEL_FLASH, estimateCostUsd } from "../lib/ai";
import {
  narratePrompt,
  type NarrateSource,
} from "../lib/ai/prompts/narrate";

const HAND_ANCHORS = [
  "Q237",     // Hannibal
  "Q183491",  // Mansa Musa
  "Q9738",    // Wu Zetian
  "Q315937",  // Tupac Amaru II
  "Q43421",   // Hatshepsut
  "Q8581",    // Saladin
  "Q81731",   // Murasaki Shikibu
  "Q8597",    // Akbar
  "Q9695",    // Songhai Empire
  "Q589285",  // Battle of Tondibi
];

const WIKIPEDIA_BUDGET = 12_000;
const BRITANNICA_BUDGET = 9_000;

async function pickCivRepresentatives(): Promise<
  Array<{ qid: string; civ: string; name: string }>
> {
  // One Tier 2+ representative per civilizational tag, prefer highest-tier
  // then highest inbound-link count.
  const rows = await db.execute<{
    qid: string;
    civ: string;
    name: string;
  }>(sql`
    SELECT DISTINCT ON (er.region_value)
      e.qid, er.region_value AS civ, e.name
    FROM entity_regions er
    JOIN entities e ON e.qid = er.entity_qid
    WHERE er.region_kind = 'civilizational'
      AND e.tier >= 2
    ORDER BY er.region_value, e.tier DESC, e.inbound_link_count DESC, e.qid ASC
  `);
  return Array.from(rows);
}

async function narrateOne(qid: string): Promise<{
  text: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  multiSource: boolean;
  golden: string | null;
} | null> {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.qid, qid))
    .limit(1);
  if (!entity) return null;

  const srcRows = await db
    .select()
    .from(sourcesTable)
    .where(eq(sourcesTable.entityQid, qid));
  const wp = srcRows.find((s) => s.sourceKind === "wikipedia");
  const br = srcRows.find((s) => s.sourceKind === "britannica_1911");
  if (!wp?.content) return null;

  const narrateSources: NarrateSource[] = [
    {
      kind: "wikipedia",
      url: wp.url ?? "",
      content: wp.content.slice(0, WIKIPEDIA_BUDGET),
    },
  ];
  if (br?.content) {
    narrateSources.push({
      kind: "britannica_1911",
      url: br.url ?? "",
      content: br.content.slice(0, BRITANNICA_BUDGET),
    });
  }

  const params = narratePrompt({
    name: entity.name,
    type: entity.type,
    dateStart: entity.dateStart,
    dateEnd: entity.dateEnd,
    sources: narrateSources,
  });

  const result = await generateText(params);
  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  return {
    text: result.text.trim(),
    costUsd: estimateCostUsd(MODEL_FLASH, inputTokens, outputTokens),
    inputTokens,
    outputTokens,
    multiSource: narrateSources.length > 1,
    golden: entity.narrative ?? null,
  };
}

function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]+?[.!?](?=\s|$)/);
  return (m ? m[0] : text.slice(0, 200)).replace(/\s+/g, " ").trim();
}

async function main(): Promise<void> {
  console.log(`Voice-lock calibration · model=${MODEL_FLASH}\n`);

  const reps = await pickCivRepresentatives();
  // Dedupe vs hand anchors.
  const handSet = new Set(HAND_ANCHORS);
  const extras = reps.filter((r) => !handSet.has(r.qid));
  const allQids = [...HAND_ANCHORS, ...extras.map((r) => r.qid)];
  console.log(
    `${HAND_ANCHORS.length} hand anchors + ${extras.length} civ reps = ${allQids.length} narratives\n`,
  );

  const report: string[] = [
    `# Voice-Lock Calibration — ${new Date().toISOString()}`,
    ``,
    `Model: \`${MODEL_FLASH}\``,
    ``,
    `Voice rules (reject + re-tune if any fail):`,
    `- No Wikipedia-flat opening ("X was a Y who…")`,
    `- No Western-default framing on non-Western subjects ("the African Alexander", etc.)`,
    `- BCE/CE only — never BC/AD`,
    ``,
  ];

  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let attempted = 0;

  for (const qid of allQids) {
    process.stdout.write(`${qid.padEnd(10)} `);
    try {
      const r = await narrateOne(qid);
      if (!r) {
        console.log("— skipped (not found or no source)");
        continue;
      }
      attempted += 1;
      totalCost += r.costUsd;
      totalInput += r.inputTokens;
      totalOutput += r.outputTokens;
      console.log(
        `${r.text.length}ch  $${r.costUsd.toFixed(4)}  ${r.multiSource ? "WP+Britannica" : "WP"}`,
      );
      report.push(`---`, ``, `## ${qid}`, ``);
      report.push(
        `**Candidate (current model) lead:** ${firstSentence(r.text)}`,
        ``,
      );
      if (r.golden) {
        report.push(
          `**Golden (current DB) lead:** ${firstSentence(r.golden)}`,
          ``,
        );
      }
      report.push(`### Candidate narrative`, ``, r.text, ``);
      if (r.golden) {
        report.push(`### Golden narrative (in DB)`, ``, r.golden, ``);
      }
    } catch (err) {
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  report.unshift(
    `Total spend: $${totalCost.toFixed(4)} (${totalInput} in / ${totalOutput} out tokens across ${attempted} narratives)`,
    ``,
  );

  await writeFile("./calibration-voice-lock.md", report.join("\n"));
  console.log(`\nReport: ./calibration-voice-lock.md`);
  console.log(`Total spend this run: $${totalCost.toFixed(4)}`);

  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
