#!/usr/bin/env tsx
/**
 * Seed the curated threads — hand-crafted paths through the corpus that
 * tell a continuous story across 5-8 entities. Editorial layer.
 *
 * Idempotent on slug: re-running upserts thread metadata, replaces the
 * entry sequence, and re-writes the bridge notes. Useful while threads
 * are still being authored.
 */
import "../lib/env";
import { eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { entities, threadEntries, threads } from "../lib/db/schema";

interface ThreadSeed {
  slug: string;
  title: string;
  blurb: string;
  intro: string;
  featured?: boolean;
  entries: Array<{
    /** Entity slug — must already exist in the corpus. */
    slug: string;
    /** Optional editorial bridge note for this stop on the path. */
    note?: string;
  }>;
}

const THREADS: ThreadSeed[] = [
  {
    slug: "gold-across-the-sahara",
    title: "Gold across the Sahara",
    blurb:
      "Six centuries of West African empires, told through the salt-and-gold caravan trade that paid for them.",
    intro:
      "Before steamships and silver mines, the world economy ran partly on the gold that came north out of the Bambuk and Bure goldfields. The story is not Mali or Songhai alone but a six-hundred-year conversation among them and the trans-Saharan trade that connected them to Cairo, Andalusia, and the Indian Ocean.",
    featured: true,
    entries: [
      {
        slug: "ghana-empire",
        note: "The first of the great Sahel polities to grow rich on the caravan trade — gold flowing north, salt and copper flowing south.",
      },
      {
        slug: "trans-saharan-trade",
        note: "The infrastructure. Camels and caravan towns spanning the desert; without them no Sahel empire is possible.",
      },
      {
        slug: "mali-empire",
        note: "Inherits Ghana's role and turns it into a court, a Sufi intellectual centre, and a player in Mediterranean finance.",
      },
      {
        slug: "mansa-musa",
        note: "Pilgrimage to Mecca in 1324. So much gold given as alms in Cairo that the Egyptian currency lost value for a decade.",
      },
      {
        slug: "timbuktu",
        note: "Where the trade hardened into permanence — a market town that grew into a university city.",
      },
      {
        slug: "songhai-empire",
        note: "The reach extends further still — Niger river valley, Hausa lands, the desert routes consolidated.",
      },
      {
        slug: "battle-of-tondibi",
        note: "1591. A Moroccan musketeer army crosses the Sahara and breaks Songhai at Tondibi. The era ends, but the goldfields and the routes remain.",
      },
    ],
  },
  {
    slug: "steel-and-steppe",
    title: "Steel and steppe",
    blurb:
      "How a confederation of nomad clans on the Mongolian plateau remade Eurasia in eighty years.",
    intro:
      "The Mongols are best remembered for what they destroyed, but the more interesting question is how they did it — and what kind of world they made afterward. The empire was assembled by a coalition that combined steppe cavalry with siege engineering and a postal network that ran from the Pacific to the Carpathians. It outlived its founder by less than a century, but the trade routes and the diseases that travelled them defined the next four hundred years.",
    entries: [
      {
        slug: "genghis-khan",
        note: "Temüjin unifies the Mongol clans by 1206 and dies twenty years later master of an empire larger than Rome.",
      },
      {
        slug: "mongol-invasion-of-europe",
        note: "Subutai's columns reach the Carpathians and the Adriatic by 1241. Then the great khan dies; the army turns back, and Europe never quite finds out what it was spared.",
      },
      {
        slug: "kublai-khan",
        note: "Founds the Yuan dynasty in China, builds Khanbaliq (modern Beijing), and presides over a sinified Mongol court that is also still nomadic.",
      },
      {
        slug: "yuan-dynasty",
        note: "At its peak under Kublai, a single trade system from Korea to Hungary — administered, in China at least, as a continuation of the imperial Chinese tradition.",
      },
      {
        slug: "marco-polo",
        note: "Lives in Kublai's court for seventeen years and brings back the report Europe will spend the next century arguing about.",
      },
      {
        slug: "silk-road",
        note: "Under the Pax Mongolica, the longest single corridor of overland trade the world has yet seen. Caravans, ideas, Bubonic plague.",
      },
      {
        slug: "black-death",
        note: "Yersinia pestis travels the same routes. Between 1346 and 1353 it kills perhaps a third of Europe and reshapes the labour and the politics that follow.",
      },
    ],
  },
  {
    slug: "the-axial-age",
    title: "The axial age",
    blurb:
      "Six teachers, all alive within a few generations of each other on three different continents — and the shape of moral thought ever since.",
    intro:
      "Karl Jaspers gave the period its name. From roughly 800 to 200 BCE, on the Yellow River, the Ganges plain, the Iranian plateau and the Greek peninsula, six teachers (give or take) articulated the moral and metaphysical frameworks the rest of human history has since been arguing with. They did not know about each other. The synchrony is the interesting part.",
    entries: [
      { slug: "confucius", note: "Lu state, fifth century BCE. The ethical posture of restraint, study, and ritual fidelity that would become the spine of East Asian civilisation." },
      { slug: "laozi", note: "Probably contemporary or slightly later. The complementary tradition: withdrawal, paradox, the path that cannot be named." },
      { slug: "the-buddha", note: "Ganges plain, also fifth century. The teaching that liberation lies in seeing the dependent arising of every condition." },
      { slug: "zoroastrianism", note: "Older, but reaching its mature form in this same window. Cosmic dualism, the ethical responsibility of free choice, the eschatology that will feed into Judaism, Christianity, and Islam." },
      { slug: "socrates", note: "Athens, late fifth century. The conviction that the unexamined life is not worth living, pursued to the end at trial." },
      { slug: "plato", note: "Athens, fourth century. The student who wrote down the master — and then built the philosophical architecture that the western tradition has been borrowing pieces from ever since." },
    ],
  },
  {
    slug: "the-fall-of-rome-isnt-the-fall-of-rome",
    title: "The fall of Rome isn't the fall of Rome",
    blurb:
      "What actually ended in 476 — and what kept going for another thousand years, in a different city, speaking Greek.",
    intro:
      "School books mark 476 CE as the year Rome fell. Historians have spent the two centuries since arguing this was the wrong year, the wrong city, and the wrong empire. The western half ended slowly; the eastern half continued — sometimes brilliantly — for another millennium, with its own languages, theological controversies, and political crises. To follow the actual story you have to leave Italy.",
    entries: [
      { slug: "constantine-the-great", note: "Refounds the empire's centre of gravity at Byzantium in 330. Everything after is in some sense reaction to this move." },
      { slug: "justinian-i", note: "Sixth-century emperor who briefly retakes Italy, codifies Roman law for the next thousand years, and builds Hagia Sophia." },
      { slug: "byzantine-empire", note: "What the eastern Romans called themselves was 'Romaioi' — Romans. The 'Byzantine' label is a later invention." },
      { slug: "fall-of-constantinople", note: "1453. An Ottoman cannon breaches the Theodosian walls. The longer story finally ends — but its religious, legal, and political DNA persists." },
      { slug: "mehmed-ii", note: "The sultan who takes the city at twenty-one. Declares himself Kayser-i Rûm — Caesar of Rome — and means it. The capital that survived the empire becomes the seat of a new one that, in its own way, continues the project." },
    ],
  },
];

async function upsertThread(seed: ThreadSeed) {
  // Verify every referenced entity exists; bail loudly if not.
  for (const e of seed.entries) {
    const [hit] = await db
      .select({ qid: entities.qid })
      .from(entities)
      .where(eq(entities.slug, e.slug))
      .limit(1);
    if (!hit) {
      throw new Error(
        `[${seed.slug}] entity slug "${e.slug}" not found in corpus`,
      );
    }
  }

  // Upsert thread row (idempotent on slug).
  const [existing] = await db
    .select()
    .from(threads)
    .where(eq(threads.slug, seed.slug))
    .limit(1);

  let threadId: number;
  if (existing) {
    await db
      .update(threads)
      .set({
        title: seed.title,
        blurb: seed.blurb,
        intro: seed.intro,
        featured: seed.featured ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(threads.id, existing.id));
    threadId = existing.id;
    // Clear existing entries — we're about to replace them.
    await db.delete(threadEntries).where(eq(threadEntries.threadId, threadId));
  } else {
    const [ins] = await db
      .insert(threads)
      .values({
        slug: seed.slug,
        title: seed.title,
        blurb: seed.blurb,
        intro: seed.intro,
        featured: seed.featured ? 1 : 0,
      })
      .returning({ id: threads.id });
    if (!ins) throw new Error("insert returned nothing");
    threadId = ins.id;
  }

  // Insert entries, resolving slug → qid in batch.
  for (let i = 0; i < seed.entries.length; i++) {
    const e = seed.entries[i]!;
    const [hit] = await db
      .select({ qid: entities.qid })
      .from(entities)
      .where(eq(entities.slug, e.slug))
      .limit(1);
    if (!hit) continue;
    await db.insert(threadEntries).values({
      threadId,
      entityQid: hit.qid,
      position: i,
      note: e.note ?? null,
    });
  }
}

async function main(): Promise<void> {
  // If multiple threads claim featured=true, the last one wins.
  // Clear featured on everything else first.
  const featured = THREADS.filter((t) => t.featured);
  if (featured.length > 1) {
    console.warn(
      `${featured.length} threads marked featured; only the last will stay featured.`,
    );
  }
  await db.update(threads).set({ featured: 0 });

  for (const seed of THREADS) {
    process.stdout.write(`  ${seed.slug.padEnd(36)} `);
    try {
      await upsertThread(seed);
      console.log(`✓  ${seed.entries.length} entries`);
    } catch (err) {
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Sanity-check we ended up with exactly one featured.
  const rows = await db.execute<{ n: number }>(
    sql`SELECT COUNT(*)::int AS n FROM threads WHERE featured = 1`,
  );
  const n = rows[0]?.n ?? 0;
  console.log(`\n${THREADS.length} threads seeded  ·  ${n} featured`);

  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
