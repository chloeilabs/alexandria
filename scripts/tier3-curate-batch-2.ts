#!/usr/bin/env tsx
/**
 * Second batch of Tier 3 anchors — extends the 5-anchor pass to the
 * full 10 from the calibration set named in the plan:
 *   Hannibal, Mansa Musa, Wu Zetian, Hatshepsut, Songhai Empire   (batch 1)
 *   Saladin, Murasaki Shikibu, Akbar, Túpac Amaru II, Bronze Age Collapse
 *
 * Same machinery as scripts/tier3-curate.ts: hand-pick Commons images
 * with captions, re-narrate at Tier 3 length with editorial focus,
 * mark tier=3.
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
  url: string;
  caption: string;
  attribution: string;
}

interface Anchor {
  slug: string;
  editorialFocus: string;
  images: Tier3Image[];
}

const ANCHORS: Anchor[] = [
  {
    slug: "saladin",
    editorialFocus:
      "The reconquest of Jerusalem in 1187 as the centerpiece scene. The contrast with Crusader behavior at the same city in 1099. Close on his contested legacy in both Islamic and European traditions.",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Saladin.jpg/600px-Saladin.jpg",
        caption: "Posthumous European depiction of Saladin, attributed to Cristofano dell'Altissimo.",
        attribution: "Public domain · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Battle_of_Hattin.svg/800px-Battle_of_Hattin.svg.png",
        caption: "The Battle of Hattin, 1187 — Saladin's destruction of the Crusader field army that opened the road to Jerusalem.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Ayyubid_Sultanate.svg/800px-Ayyubid_Sultanate.svg.png",
        caption: "The Ayyubid Sultanate at Saladin's death in 1193 — Egypt and Syria reunited under one ruling house.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
    ],
  },
  {
    slug: "murasaki-shikibu",
    editorialFocus:
      "Open on the Heian court of the early 11th century — its etiquette, its diarists, its sealed culture. The Tale of Genji as the world's first novel, a thousand years before the form is named in Europe. Close on what we know and don't know about her own life.",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Murasaki_Shikibu_Diary_Emaki.jpg/800px-Murasaki_Shikibu_Diary_Emaki.jpg",
        caption: "Murasaki Shikibu writing the diary — from the illustrated Murasaki Shikibu Diary Emaki, 13th century.",
        attribution: "Public domain · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Genji_emaki_TAKEKAWA.jpg/800px-Genji_emaki_TAKEKAWA.jpg",
        caption: "A scene from the Tale of Genji Emaki, the earliest surviving illustrated Genji manuscript (12th century).",
        attribution: "Public domain · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Tosa_Mitsuoki_001.jpg/600px-Tosa_Mitsuoki_001.jpg",
        caption: "Murasaki at Ishiyama-dera, by Tosa Mitsuoki — the legend that she began Genji during a moon-viewing retreat.",
        attribution: "Public domain · via Wikimedia Commons",
      },
    ],
  },
  {
    slug: "akbar",
    editorialFocus:
      "The Mughal at its imperial peak — military genius, administrative reformer, theological pluralist. Open on the Ibadat Khana debates where Akbar invited Hindus, Jains, Zoroastrians, Christians, and Muslims to argue theology. Close on Din-i Ilahi and what it meant to attempt a synthesis.",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/1605-Akbar_hands_crown_to_Shahjahan_PadshahnamaIVA.jpg/800px-1605-Akbar_hands_crown_to_Shahjahan_PadshahnamaIVA.jpg",
        caption: "Akbar handing the imperial crown to his grandson, the future Shah Jahan. From the Padshahnama, 17th century.",
        attribution: "Public domain · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Religious_debate_at_Ibadat_Khana.jpg/800px-Religious_debate_at_Ibadat_Khana.jpg",
        caption: "Theological debate at the Ibadat Khana, Fatehpur Sikri. From Akbarnama, c. 1605.",
        attribution: "Public domain · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Fatehpur_Sikri_-_Diwan-i-Khas.jpg/800px-Fatehpur_Sikri_-_Diwan-i-Khas.jpg",
        caption: "The Diwan-i-Khas at Fatehpur Sikri, Akbar's imperial capital. The throne column suggests a fifth point of the universe.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
    ],
  },
  {
    slug: "tupac-amaru-ii",
    editorialFocus:
      "Open on the 1781 uprising — the largest indigenous revolt against Spanish colonial rule. The contrast between his self-conception (heir of the Incas, baptized as José Gabriel Condorcanqui) and what the Spanish saw. The execution at Cusco, deliberately staged as a public spectacle to crush the symbol. Close on what survived of the movement.",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/JoseGabrielTupacAmaruII.jpg/600px-JoseGabrielTupacAmaruII.jpg",
        caption: "Túpac Amaru II — a 19th-century painted portrait based on contemporary descriptions.",
        attribution: "Public domain · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Tupac_Amaru_II_Andean_Holy_Trinity.jpg/600px-Tupac_Amaru_II_Andean_Holy_Trinity.jpg",
        caption: "Túpac Amaru II in Inca dress with an Andean Trinity behind him — religious-political iconography of the rebellion.",
        attribution: "Public domain · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Map_of_Tupac_Amaru_II_rebellion.png/800px-Map_of_Tupac_Amaru_II_rebellion.png",
        caption: "The geography of the 1780–1783 rebellion, from the Andean highlands south to Lake Titicaca.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
    ],
  },
  {
    slug: "bronze-age-collapse",
    editorialFocus:
      "Open on the timeframe — within fifty years, around 1200 BCE, every major Bronze Age civilization of the eastern Mediterranean collapsed simultaneously. The mystery of the Sea Peoples, the climate evidence from Greenland ice cores and pollen analysis, the systems-collapse hypotheses. Close on what came out the other side: smaller polities, iron, the Greek alphabet adapted from Phoenician.",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Sea_Peoples_-_Medinet_Habu_-_North_Wall.jpg/800px-Sea_Peoples_-_Medinet_Habu_-_North_Wall.jpg",
        caption: "Sea Peoples depicted in relief at Medinet Habu — Ramesses III's mortuary temple, c. 1175 BCE.",
        attribution: "Public domain · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Late_Bronze_Age_collapse_map.svg/800px-Late_Bronze_Age_collapse_map.svg.png",
        caption: "Major Bronze Age polities of the eastern Mediterranean before the collapse, c. 1300 BCE.",
        attribution: "CC BY-SA · via Wikimedia Commons",
      },
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Lion_Gate%2C_Mycenae.jpg/800px-Lion_Gate%2C_Mycenae.jpg",
        caption: "The Lion Gate at Mycenae — one of the great Bronze Age centres that fell in the collapse.",
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
      // 6K-char trim per source. With two long sources Gemini sometimes
      // exhausts output tokens on internal reasoning and returns empty
      // text. Trimming keeps the input under control without losing the
      // narrative material in the first ~6K (chronological coverage).
      content: s.content.slice(0, 6000),
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
  console.log(`Curating ${ANCHORS.length} additional Tier 3 anchors…\n`);
  let ok = 0;
  let failed = 0;
  let totalCost = 0;
  for (const a of ANCHORS) {
    const r = await curate(a);
    if (r.status === "ok") {
      ok += 1;
      totalCost += r.cost ?? 0;
    } else {
      failed += 1;
    }
  }
  console.log(`\n${ok}/${ANCHORS.length} curated  ·  ${failed} failed`);
  console.log(`Total spend this run: $${totalCost.toFixed(4)}`);
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
