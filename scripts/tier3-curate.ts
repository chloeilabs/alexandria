#!/usr/bin/env tsx
/**
 * Promote a small hand-picked list of entities to Tier 3.
 *
 * For each anchor in ANCHORS:
 *   1. Insert hand-picked Commons images into `media` (skip duplicates).
 *   2. Re-narrate with the Tier 3 prompt (2.5–3.5K words, ~5x narrate cost).
 *   3. Set tier=3, tierUpgradedAt=now.
 *
 * Idempotent. Re-running pulls fresh Tier-3 prose (which may differ
 * across runs) but won't duplicate images.
 *
 * Usage:
 *   pnpm tsx scripts/tier3-curate.ts
 *   pnpm tsx scripts/tier3-curate.ts --only=hannibal,mansa-musa
 */
import "../lib/env";
import { generateText } from "ai";
import { eq } from "drizzle-orm";

import { db } from "../lib/db";
import {
  entities,
  media,
  pipelineRuns,
  sources,
} from "../lib/db/schema";
import {
  MODEL_FLASH,
  estimateCostUsd,
  roughTokensFromChars,
} from "../lib/ai";
import { tier3NarratePrompt } from "../lib/ai/prompts/tier3-narrate";
import { checkBudget } from "../pipeline/budget";
import type { NarrateSource } from "../lib/ai/prompts/narrate";

interface Tier3Image {
  /** Direct URL to a Commons file (or upload.wikimedia.org thumb). */
  url: string;
  /** Caption to render under the image. Required — Tier 3 isn't a stock grid. */
  caption: string;
  attribution: string;
}

interface Anchor {
  slug: string;
  editorialFocus: string;
  images: Tier3Image[];
}

// 5 anchors for the first Tier 3 pass. Image URLs point to scaled
// thumbnails on upload.wikimedia.org — small file size, sharp at the
// hero+thumbnail sizes Next renders. Captions are hand-written.
const ANCHORS: Anchor[] = [
  {
    slug: "hannibal",
    editorialFocus:
      "The tactical brilliance and the strategic isolation. Develop Cannae as a scene; close on the long Carthaginian exile.",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Mommsen_p265.jpg/800px-Mommsen_p265.jpg",
        caption: "Hannibal's route across the Alps in 218 BCE, from Mommsen's history of Rome.",
        attribution: "Public domain · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Battle_of_Cannae%2C_215_BC_-_Initial_Roman_attack.gif/800px-Battle_of_Cannae%2C_215_BC_-_Initial_Roman_attack.gif",
        caption: "The opening of Cannae, 216 BCE. The Roman centre advances against Hannibal's inverted crescent.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Mommsen_p265b.jpg/800px-Mommsen_p265b.jpg",
        caption: "The double envelopment complete. Roman infantry pinned, cavalry returned to seal the rear.",
        attribution: "Public domain · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Hannibal3.jpg/600px-Hannibal3.jpg",
        caption: "Marble bust traditionally identified as Hannibal Barca; Capua, found 1900s.",
        attribution: "Public domain · via Wikimedia Commons",
      },
    ],
  },
  {
    slug: "mansa-musa",
    editorialFocus:
      "The 1324 pilgrimage as a single scene; the long aftermath on Cairo and the trans-Saharan economy.",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Catalan_Atlas_BNF_Sheet_6_Mansa_Musa.jpg/800px-Catalan_Atlas_BNF_Sheet_6_Mansa_Musa.jpg",
        caption: "Mansa Musa on the Catalan Atlas of 1375. A gold disc in one hand, a sceptre in the other.",
        attribution: "Public domain · BnF, Paris · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Sankore_Mosque%2C_Timbuktu.jpg/800px-Sankore_Mosque%2C_Timbuktu.jpg",
        caption: "The Sankoré Madrasah in Timbuktu, founded under Mansa Musa's patronage on his return from Mecca.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Mali_Empire_1337.png/800px-Mali_Empire_1337.png",
        caption: "The Mali Empire at its furthest extent, c. 1337 — the decade after Mansa Musa's death.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
    ],
  },
  {
    slug: "wu-zetian",
    editorialFocus:
      "Open at her accession in 690 CE as the only female emperor in Chinese history. Develop the bureaucratic reforms; close on her contested legacy.",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/A_Tang_Dynasty_Empress_Wu_Zetian.JPG/600px-A_Tang_Dynasty_Empress_Wu_Zetian.JPG",
        caption: "Wu Zetian in formal court dress. Tang-era depiction, reproduced from a later painted album.",
        attribution: "Public domain · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Empress_Wu_Zetian_Tomb_Stele.jpg/800px-Empress_Wu_Zetian_Tomb_Stele.jpg",
        caption: "The deliberately blank stele at the Qianling Mausoleum — Wu Zetian's tomb has no inscribed assessment of her reign.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Tang_dynasty_circa_700_CE.png/800px-Tang_dynasty_circa_700_CE.png",
        caption: "Tang China c. 700 CE — the empire Wu Zetian ruled at its mature reach into central Asia.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
    ],
  },
  {
    slug: "hatshepsut",
    editorialFocus:
      "The first major female pharaoh; the deliberate erasure by Thutmose III; what we learned when the temple at Deir el-Bahari was excavated.",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Hatshepsut.jpg/600px-Hatshepsut.jpg",
        caption: "Granite seated statue of Hatshepsut in male pharaonic regalia, from her mortuary temple.",
        attribution: "Public domain · Metropolitan Museum of Art · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/DeirElBahari.jpg/800px-DeirElBahari.jpg",
        caption: "Djeser-Djeseru, the mortuary temple of Hatshepsut at Deir el-Bahari. Built into the cliffs at western Thebes.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Punt_relief.jpg/800px-Punt_relief.jpg",
        caption: "Reliefs from Deir el-Bahari depicting the expedition to Punt — the diplomatic centrepiece of her reign.",
        attribution: "Public domain · via Wikimedia Commons",
      },
    ],
  },
  {
    slug: "songhai-empire",
    editorialFocus:
      "Songhai as the largest African empire of the early modern era. The Battle of Tondibi as the closing image; the aftermath for West African Islam and the trans-Saharan trade.",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/SONGHAI_empire_map.PNG/800px-SONGHAI_empire_map.PNG",
        caption: "The Songhai Empire at its furthest reach, late fifteenth and early sixteenth centuries.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Tomb_of_Askia%2C_Gao%2C_Mali.jpg/800px-Tomb_of_Askia%2C_Gao%2C_Mali.jpg",
        caption: "The Tomb of Askia in Gao, Mali — Songhai's capital. Built c. 1495 for Askia Muhammad.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Sankore_Mosque_Timbuktu.jpg/800px-Sankore_Mosque_Timbuktu.jpg",
        caption: "Sankoré in Timbuktu under Songhai sovereignty — a centre of Islamic scholarship rivalling Cairo and Fez.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
    ],
  },
];

async function curate(anchor: Anchor) {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.slug, anchor.slug))
    .limit(1);
  if (!entity) {
    console.log(`  ${anchor.slug.padEnd(28)} ✗  not in corpus`);
    return { status: "missing" as const };
  }

  // 1. Insert images. ON CONFLICT DO NOTHING on (commons_url).
  for (const img of anchor.images) {
    await db
      .insert(media)
      .values({
        entityQid: entity.qid,
        commonsUrl: img.url,
        kind: "image",
        license: "PD/CC BY-SA",
        attribution: img.attribution,
        caption: img.caption,
      })
      .onConflictDoNothing({ target: [media.commonsUrl] });
  }

  // 2. Re-narrate at Tier 3 length.
  const srcRows = await db
    .select()
    .from(sources)
    .where(eq(sources.entityQid, entity.qid));
  const narrateSources: NarrateSource[] = srcRows
    .filter(
      (s) =>
        s.sourceKind === "wikipedia" ||
        s.sourceKind === "britannica_1911" ||
        s.sourceKind === "sep",
    )
    .map((s) => ({
      kind: s.sourceKind as "wikipedia" | "britannica_1911" | "sep",
      url: s.url ?? undefined,
      content: s.content,
    }));
  if (narrateSources.length === 0) {
    console.log(`  ${anchor.slug.padEnd(28)} ✗  no sources`);
    return { status: "no_sources" as const };
  }

  const params = tier3NarratePrompt({
    name: entity.name,
    type: entity.type,
    dateStart: entity.dateStart,
    dateEnd: entity.dateEnd,
    sources: narrateSources,
    editorialFocus: anchor.editorialFocus,
  });

  const estTokens = roughTokensFromChars(
    params.system.length + params.prompt.length,
  );
  const estCost = estimateCostUsd(MODEL_FLASH, estTokens, params.maxOutputTokens);
  await checkBudget(estCost);

  const t0 = Date.now();
  const result = await generateText(params);
  const narrative = result.text.trim();
  if (!narrative) {
    console.log(`  ${anchor.slug.padEnd(28)} ✗  empty narrative`);
    return { status: "failed" as const };
  }
  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const actualCost = estimateCostUsd(MODEL_FLASH, inputTokens, outputTokens);

  await db.transaction(async (tx) => {
    await tx
      .update(entities)
      .set({
        narrative,
        tier: 3,
        tierUpgradedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(entities.qid, entity.qid));

    await tx.insert(pipelineRuns).values({
      jobKind: "tier3-curate",
      startedAt: new Date(t0),
      finishedAt: new Date(),
      entitiesProcessed: 1,
      apiCostUsd: actualCost.toString(),
      status: "completed",
    });
  });

  console.log(
    `  ${anchor.slug.padEnd(28)} ✓  ${narrative.length}c  ${anchor.images.length} imgs  $${actualCost.toFixed(4)}`,
  );
  return { status: "ok" as const, cost: actualCost };
}

async function main(): Promise<void> {
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const onlyList = onlyArg
    ? new Set(onlyArg.slice("--only=".length).split(",").map((s) => s.trim()))
    : null;
  const targets = onlyList
    ? ANCHORS.filter((a) => onlyList.has(a.slug))
    : ANCHORS;

  console.log(`Curating ${targets.length} Tier 3 anchors…\n`);

  let ok = 0;
  let failed = 0;
  let totalCost = 0;
  for (const a of targets) {
    const r = await curate(a);
    if (r.status === "ok") {
      ok += 1;
      totalCost += r.cost ?? 0;
    } else {
      failed += 1;
    }
  }

  console.log(`\n${ok}/${targets.length} curated  ·  ${failed} failed`);
  console.log(`Total spend this run: $${totalCost.toFixed(4)}`);
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
