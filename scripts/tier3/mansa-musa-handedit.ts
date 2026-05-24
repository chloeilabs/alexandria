#!/usr/bin/env tsx
/**
 * Hand-edited Tier 3 narrative for Mansa Musa (Q183491).
 *
 * The May 2026 AI-generated Tier 3 narrative was already strong:
 * specific scholarly sources, oral-tradition counter-narrative,
 * archaeological grounding, critical engagement with Eurocentric
 * myth-making. This pass is voice-only — tighter prose, fewer
 * AI-isms ("immense," "spectacular," "unbridled," "intolerable"),
 * a hookier opening, a closing that lands instead of asking
 * rhetorical questions.
 *
 * Sets the editorial benchmark for what hand-edited Tier 3 should
 * sound like. Future passes on the other 9 anchors can use this
 * as a tone reference.
 *
 * Idempotent: safe to re-run.
 */
import "../../lib/env";
import { eq } from "drizzle-orm";

import { db } from "../../lib/db";
import { entities } from "../../lib/db/schema";

const QID = "Q183491";

const NARRATIVE = `In July 1324, the people of Cairo watched a city of tents bloom on the west bank of the Nile, at the foot of the Pyramids of Giza. The encampment belonged to Mansa Musa, ninth ruler of the Mali Empire, paused on his journey from the western Sahel to Mecca. He was a young man — contemporary chroniclers in Cairo described him as handsome and brown-skinned, with an intelligent face. Behind him stretched twenty-seven hundred miles of Sahel and Sahara; ahead lay the great cities of the Islamic world, which he meant to enter as an equal, not a supplicant. The scale of his retinue — thousands of attendants, soldiers, and officials, with later chroniclers giving figures like twelve thousand staff in Yemeni silk and eighty camels each carrying a bag of gold dust — was the point. Heralds in silks bore staffs of solid gold; the column stretched to the horizon. Whether the numbers were audited or were the literary topos of the era for "an unprecedented scale," the visual reality of the caravan moving through the North African summer was the same.

The encounter with the Mamluk sultan, al-Nasir Muhammad, came on July 19, 1324, after Musa crossed the Nile and set up court in Cairo's Qarafa district. Mamluk diplomatic protocol required the visiting ruler to prostrate himself — kiss the ground before the throne. Musa refused. To bow before another earthly monarch was not a posture available to a sovereign whose domains ran across what is now Mali, Guinea, Senegal, Mauritania, and the Gambia — roughly 1.3 million square kilometers. The impasse held until Musa found the escape: if he bowed, he would bow to God alone. He prostrated himself toward Mecca rather than the throne, the sultans embraced, and three months of intensive interaction began.

His generosity in those three months wrecked the Cairo gold market. Staying as the guest of the governor, Ibn Amir Hajib, Musa distributed gold dust and coin to officials, religious foundations, the poor, and the merchants of Cairene markets — who realized quickly that their West African guests carried apparently inexhaustible specie but little sense of local prices. The Egyptian scholar Shihab al-Din al-Umari, who reached Cairo not long after Musa left and interviewed people who had dealt with the king directly, recorded that the gold *mithqal* had been worth twenty-five silver *dirhams* before the visit. After Musa, it dropped below twenty-two and stayed depressed for twelve years. The historian Warren Schultz has argued that this swing fell within the normal range of medieval Egyptian currency fluctuation — that "Musa wrecked Egypt's economy" overstates the case. The psychological event, though, was unmistakable: an African empire had unilaterally dictated the monetary realities of the Mamluk capital.

The display was the surface; the system underneath was the point. Mali did not own or directly mine the goldfields of Bambuk and Bure to the south — contrary to rumors Musa himself encouraged, in which gold grew like a plant in his fields. Its wealth came from taxing the trans-Saharan trade. The empire funneled alluvial gold from the south and exchanged it for salt mined in the harsh deserts of the north. In sub-Saharan Africa, where salt was scarce but essential for survival, the exchange ran heavily in Mali's favor, and the state took a cut on every ounce crossing its borders in either direction. Ivory, spices, silks, ceramics, and enslaved people moved through the same network, though the second-order trade is less well documented. The infrastructure was technical as well as administrative: at the desert trading site of Tadmekka, archaeology has recovered a Malian gold-refining process that used molten glass to strip impurities from raw dust, producing a purified gold coveted across the Old World. By the fourteenth century, an estimated two-thirds of the gold circulating in the medieval Mediterranean came from West Africa, and roughly half of the total gold supply across Europe, North Africa, and the Middle East. Musa was the most visible beneficiary of a Sahelian economic engine that had been turning for generations.

What followed the pilgrimage's high point was a collapse. Leaving Mecca — where Musa had again spent heavily and personally defused an armed standoff between his pilgrims and Turkic worshippers in the Masjid al-Haram — the Malian caravan returned independently of the main pilgrim trains. On the road back, weather and bandits did what the Sahara had not: severe cold, starvation, repeated raids. By the time the survivors reached Suez, the logistical reserves were gone. Musa, who had set out with enough gold to depress the Cairo market, found himself broke and in debt. He returned to Cairene merchants like Siraj al-Din for loans at high interest, selling back luxury goods he had bought weeks earlier. Sultan al-Nasir Muhammad helped with reciprocal gifts. Ibn al-Dawadari, al-Umari, and Ibn Khaldun all describe the king returning home in financial embarrassment; some report the Egyptian lenders were never fully repaid. The swing from solvency-defining wealth to insolvency was a week of bad weather and desert raids — a reminder, the chronicles seem to be saying, that no medieval continental crossing was guaranteed.

The cultural side of the pilgrimage outlasted the financial one. While in the east, Musa recruited scholars, jurists, and artists to return with him, knitting Mali more tightly into the intellectual networks of the wider Islamic world. The most famous recruit was the Andalusian poet and Maliki jurist Abu Ishaq al-Sahili. Older colonial-era historiography credited al-Sahili with single-handedly importing Andalusian and Maghrebi architecture to West Africa — designing the Djinguereber Mosque of Timbuktu and Musa's royal palace. Modern scholarship has dismantled the claim. J. O. Hunwick has shown that the only construction project contemporary Arabic sources actually pin on al-Sahili is a royal audience chamber in the Malian capital, for which he was paid twelve thousand gold *mithqals* (about fifty-one kilograms) — substantial money, but decorative and administrative work, not structural. The architectural historian Labelle Prussin has further argued that the *banco* (earthen) architecture of the Niger bend, with its projecting *toron* timbers, is a centuries-old synthesis of indigenous West African and Islamic building practice, not an import. The archaeology backs her: Susan and Roderick McIntosh's excavations at Djenné-Djenno show urban planning, brick and earthen architecture, and advanced iron metallurgy in the Inland Niger Delta from the third century BCE — eight hundred years before the empire of Mali, sixteen hundred before the pilgrimage. Musa did not import urban civilization to West Africa. He supercharged an old one with new imperial resources and international reputation.

The synthesis settled into Timbuktu and Gao. According to the seventeenth-century *Tarikh al-Sudan*, both cities of the Niger bend submitted to Musa on the return journey of 1325. The conquest of Gao may have happened earlier under the general Saghmanja, or even earlier still under Mansa Sakura — the chronology is unsettled — but the consolidation of Timbuktu and Gao under direct rule marked Mali's territorial peak. Timbuktu was the city Musa transformed most visibly. Merchants from Venice, Genoa, Granada, and Hausaland arrived to trade European manufactured goods for West African gold. The Sankore Madrasah expanded with imperial funding and a faculty of astronomers, mathematicians, and Maliki jurists recruited from across North Africa and the Middle East. When the rival Mossi kingdom sacked Timbuktu in 1330, Musa recaptured the city quickly, built a rampart and a stone fort, and garrisoned a standing army — a posture indicating that he understood Timbuktu's libraries and markets as imperial assets worth defending militarily.

The legacy splits, sharply, between external chronicles and internal oral tradition. In Europe, Musa became the personification of African wealth: the 1375 Catalan Atlas placed him at the center of West Africa, crowned and seated on a golden throne, holding a sceptre and a fist-sized gold nugget, captioned "the richest lord in all this region." Twenty-first-century popular media has stretched that to "the richest man in history" — a claim the historian Hadrien Collet points out is methodologically impossible to test, and reads better as a translation of medieval hyperbole than as economic statistics. Inside Mali, the picture is harder. The *jeliw* — the Mandinka oral historians who preserve dynastic memory across generations — give Musa a small and sometimes uncomfortable place in the chronicle. While the empire's founder Sunjata Keita is celebrated as a heroic ancestor, Musa is sometimes criticized for spending the empire's wealth on a foreign pilgrimage and drifting from ancestral Mandinka religious practice. In some *jeli* accounts, his memory is folded into the figure of "Fajigi" — "father of hope" — who travels to Mecca not for Islamic piety but to retrieve sacred ceremonial *boliw* tied to pre-Islamic Mandinka religion. The conflation suggests that despite Musa's orthodox Islam, his memory had to be reconciled with a deeper, non-Islamic cultural substrate that the empire never displaced.

The end of his reign is uncertain. Proposed death dates range from 1332 to 1337. Ibn Khaldun, calculating backward from later reigns, gives 1332. Al-Umari, writing around 1337, says Musa had returned to Mali intending to abdicate and live in Mecca but died before he could leave. Ibn Khaldun also records, complicatingly, a Malian diplomatic mission congratulating the Marinid sultan Abu al-Hasan Ali on the conquest of Tlemcen in May 1337 — implying Musa was alive then. Nehemia Levtzion has argued that 1337 is most likely, with the earlier dates a confusion among Musa, his son Maghan, and his brother Sulayman, who succeeded after Maghan's brief reign and presided over the empire's late golden age.

When Musa died, he left an empire at its territorial and cultural peak — a state whose wealth had redrawn European mapmaking and bent the monetary policy of Mamluk Egypt. Within two generations, the trans-Saharan gold trade would begin shifting west to coastal markets reached by Portuguese ships, and the cartographic image of Africa as a kingdom of gold thrones would dissolve into the very different geography of the Atlantic slave trade. The Catalan Atlas of 1375 — drawn fifty years after the pilgrimage, by Majorcan cartographers who had never seen a Sahelian king and were working from sailors' reports of Cairo — would survive as one of the last European images of a sub-Saharan African ruler depicted on his own terms.`;

async function main(): Promise<void> {
  const before = await db
    .select({ length: entities.narrative })
    .from(entities)
    .where(eq(entities.qid, QID))
    .limit(1);
  if (before.length === 0) {
    console.error(`Entity ${QID} not found.`);
    process.exit(1);
  }
  const wasLength = before[0]?.length?.length ?? 0;

  await db
    .update(entities)
    .set({
      narrative: NARRATIVE,
      tier: 3,
      tierUpgradedAt: new Date(),
    })
    .where(eq(entities.qid, QID));

  console.log(
    `Updated ${QID} (Mansa Musa) — narrative ${wasLength} → ${NARRATIVE.length} chars (${NARRATIVE.length < wasLength ? "tightened" : "expanded"}).`,
  );
  await db.$client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
