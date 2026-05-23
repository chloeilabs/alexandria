#!/usr/bin/env tsx
/**
 * Run Tier 2 narration against the 10 calibration entities. This is the
 * voice-lock checkpoint — inspect the prose before scaling.
 *
 * Calibration set (DECISIONS.md): Hannibal, Mansa Musa, Wu Zetian, Tupac
 * Amaru II, Hatshepsut, Saladin, Murasaki Shikibu, Akbar, Bronze Age
 * Collapse, Songhai Empire.
 *
 * (We dropped Bronze Age Collapse from the active set — never resolved
 *  in the seeded corpus; substituting Battle of Tondibi which captures
 *  the same theme.)
 */
import "../lib/env";
import { narrateEntity } from "../pipeline/workers/narrate";
import { db } from "../lib/db";

const CALIBRATION_QIDS = [
  "Q237", // Hannibal
  "Q183491", // Mansa Musa
  "Q9738", // Wu Zetian
  "Q315937", // Tupac Amaru II
  "Q43421", // Hatshepsut
  "Q8581", // Saladin
  "Q81731", // Murasaki Shikibu
  "Q8597", // Akbar
  "Q9695", // Songhai Empire
  "Q589285", // Battle of Tondibi (substitute for Bronze Age Collapse)
];

async function main(): Promise<void> {
  console.log(`Narrating ${CALIBRATION_QIDS.length} calibration entities…\n`);
  let totalCost = 0;
  for (const qid of CALIBRATION_QIDS) {
    process.stdout.write(`${qid.padEnd(10)} `);
    try {
      const r = await narrateEntity(qid);
      if (r.status === "ok") {
        totalCost += r.costUsd ?? 0;
        console.log(
          `✓ Tier 2  (${r.narrative?.length ?? 0} chars, $${(r.costUsd ?? 0).toFixed(4)})`,
        );
        console.log("\n" + r.narrative + "\n");
        console.log("---\n");
      } else {
        console.log(`— ${r.status}`);
      }
    } catch (err) {
      console.log(`✗ ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`Total spend this run: $${totalCost.toFixed(4)}`);
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
