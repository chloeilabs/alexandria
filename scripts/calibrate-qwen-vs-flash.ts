#!/usr/bin/env tsx
/**
 * Read-only bake-off: re-narrate the 10 calibration anchors with both
 * MODEL_FLASH (google/gemini-3.5-flash, current baseline) and MODEL_PRO
 * (alibaba/qwen3.7-max, candidate replacement). Compares prose against
 * the existing live narrative; never writes to the DB.
 *
 * Run:
 *   pnpm tsx scripts/calibrate-qwen-vs-flash.ts
 *   (writes a Markdown report to ./calibration-bake-off.md and prints
 *    a summary table.)
 *
 * Cost: 10 entities × 2 models × ~$0.015 ≈ $0.30. Well under the daily cap.
 */

import "../lib/env";
import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { writeFile } from "node:fs/promises";

import { db } from "../lib/db";
import { entities, sources as sourcesTable } from "../lib/db/schema";
import {
  MODEL_FLASH,
  MODEL_PRO,
  PRICING,
  estimateCostUsd,
} from "../lib/ai";
import {
  narratePrompt,
  type NarrateSource,
} from "../lib/ai/prompts/narrate";

const CALIBRATION_QIDS = [
  "Q237", // Hannibal
  "Q183491", // Mansa Musa (hand-edited editorial benchmark)
  "Q9738", // Wu Zetian
  "Q315937", // Tupac Amaru II
  "Q43421", // Hatshepsut
  "Q8581", // Saladin
  "Q81731", // Murasaki Shikibu
  "Q8597", // Akbar
  "Q9695", // Songhai Empire
  "Q589285", // Battle of Tondibi (substitute for Bronze Age Collapse)
];

const WIKIPEDIA_BUDGET = 12_000;
const BRITANNICA_BUDGET = 9_000;

interface CallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  elapsedMs: number;
}

async function runOne(
  model: typeof MODEL_FLASH | typeof MODEL_PRO,
  entity: typeof entities.$inferSelect,
  narrateSources: NarrateSource[],
): Promise<CallResult> {
  const base = narratePrompt({
    name: entity.name,
    type: entity.type,
    dateStart: entity.dateStart,
    dateEnd: entity.dateEnd,
    sources: narrateSources,
  });
  // Strip Google-specific provider options when running on Qwen; add
  // `reasoning: { effort: 'none' }` to suppress Qwen's hidden reasoning
  // tokens, which dominated billed output in the first bake-off and made
  // Qwen 1.36× more expensive than Flash. AI Gateway maps `effort: 'none'`
  // to the per-provider reasoning-off knob.
  const params =
    model === MODEL_FLASH
      ? { ...base, model }
      : ({
          ...base,
          model,
          providerOptions: undefined,
          reasoning: { effort: "none" as const },
        } as Parameters<typeof generateText>[0]);
  const t0 = Date.now();
  const result = await generateText(params);
  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  return {
    text: result.text.trim(),
    inputTokens,
    outputTokens,
    costUsd: estimateCostUsd(model, inputTokens, outputTokens),
    elapsedMs: Date.now() - t0,
  };
}

function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]+?[.!?](?=\s|$)/);
  return (m ? m[0] : text.slice(0, 200)).replace(/\s+/g, " ").trim();
}

async function main(): Promise<void> {
  console.log(`Bake-off: ${MODEL_FLASH}  vs  ${MODEL_PRO}\n`);
  console.log(`Flash pricing:  $${PRICING[MODEL_FLASH]?.input}/M in, $${PRICING[MODEL_FLASH]?.output}/M out`);
  console.log(`Pro   pricing:  $${PRICING[MODEL_PRO]?.input}/M in, $${PRICING[MODEL_PRO]?.output}/M out`);
  console.log();

  const report: string[] = [
    `# Qwen3.7-Max vs Gemini 3.5 Flash — Calibration Bake-Off`,
    ``,
    `Run date: ${new Date().toISOString()}`,
    ``,
    `Both models receive identical prompts (lib/ai/prompts/narrate.ts) and identical source bundles (existing rows in \`sources\`).`,
    ``,
    `Pricing: Flash \`$${PRICING[MODEL_FLASH]?.input}/$${PRICING[MODEL_FLASH]?.output}\` per M, Pro \`$${PRICING[MODEL_PRO]?.input}/$${PRICING[MODEL_PRO]?.output}\` per M.`,
    ``,
  ];

  const summary: Array<{
    qid: string;
    name: string;
    flashLen: number;
    proLen: number;
    flashCost: number;
    proCost: number;
    flashMs: number;
    proMs: number;
  }> = [];

  let totalFlashCost = 0;
  let totalProCost = 0;

  for (const qid of CALIBRATION_QIDS) {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.qid, qid))
      .limit(1);
    if (!entity) {
      console.log(`${qid.padEnd(10)} — not found, skipping`);
      continue;
    }

    const srcRows = await db
      .select()
      .from(sourcesTable)
      .where(eq(sourcesTable.entityQid, qid));
    const wp = srcRows.find((s) => s.sourceKind === "wikipedia");
    const br = srcRows.find((s) => s.sourceKind === "britannica_1911");
    if (!wp?.content) {
      console.log(`${qid.padEnd(10)} ${entity.name} — no Wikipedia source, skipping`);
      continue;
    }

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
    const sourceLabel = br ? "WP+Britannica" : "WP only";

    process.stdout.write(`${qid.padEnd(10)} ${entity.name.padEnd(28)} ${sourceLabel.padEnd(15)} `);

    try {
      const [flash, pro] = await Promise.all([
        runOne(MODEL_FLASH, entity, narrateSources),
        runOne(MODEL_PRO, entity, narrateSources),
      ]);
      totalFlashCost += flash.costUsd;
      totalProCost += pro.costUsd;
      summary.push({
        qid,
        name: entity.name,
        flashLen: flash.text.length,
        proLen: pro.text.length,
        flashCost: flash.costUsd,
        proCost: pro.costUsd,
        flashMs: flash.elapsedMs,
        proMs: pro.elapsedMs,
      });
      console.log(
        `Flash ${flash.text.length}ch/$${flash.costUsd.toFixed(4)}/${flash.elapsedMs}ms  Qwen ${pro.text.length}ch/$${pro.costUsd.toFixed(4)}/${pro.elapsedMs}ms`,
      );

      report.push(`---`, ``, `## ${entity.name} (${qid}) — ${sourceLabel}`, ``);
      report.push(`**Flash lead:** ${firstSentence(flash.text)}`, ``);
      report.push(`**Qwen lead:**  ${firstSentence(pro.text)}`, ``);
      report.push(`| | Length | Cost | Latency |`);
      report.push(`|---|---|---|---|`);
      report.push(`| Flash | ${flash.text.length} chars | $${flash.costUsd.toFixed(4)} | ${flash.elapsedMs}ms |`);
      report.push(`| Qwen | ${pro.text.length} chars | $${pro.costUsd.toFixed(4)} | ${pro.elapsedMs}ms |`);
      report.push(``);
      report.push(`### Flash narrative`, ``, flash.text, ``);
      report.push(`### Qwen narrative`, ``, pro.text, ``);
    } catch (err) {
      console.log(`✗ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log();
  console.log(`Total Flash cost: $${totalFlashCost.toFixed(4)}`);
  console.log(`Total Qwen  cost: $${totalProCost.toFixed(4)}`);
  console.log(
    `Cost ratio: Qwen is ${(totalProCost / totalFlashCost).toFixed(2)}× Flash (smaller = cheaper)`,
  );

  // Length comparison — useful proxy for whether one model under/over-writes
  // relative to the other.
  const meanFlashLen = summary.reduce((a, b) => a + b.flashLen, 0) / summary.length;
  const meanProLen = summary.reduce((a, b) => a + b.proLen, 0) / summary.length;
  console.log(`Mean output length: Flash ${Math.round(meanFlashLen)}ch  Qwen ${Math.round(meanProLen)}ch`);

  report.push(`---`, ``, `## Aggregate`, ``);
  report.push(`| | Mean length | Total cost | Mean latency |`);
  report.push(`|---|---|---|---|`);
  report.push(
    `| Flash | ${Math.round(meanFlashLen)} chars | $${totalFlashCost.toFixed(4)} | ${Math.round(summary.reduce((a, b) => a + b.flashMs, 0) / summary.length)}ms |`,
  );
  report.push(
    `| Qwen | ${Math.round(meanProLen)} chars | $${totalProCost.toFixed(4)} | ${Math.round(summary.reduce((a, b) => a + b.proMs, 0) / summary.length)}ms |`,
  );
  report.push(``);

  const outPath = "./calibration-bake-off.md";
  await writeFile(outPath, report.join("\n"));
  console.log(`\nFull side-by-side report written to ${outPath}`);

  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
