# Open Questions

Items I need editorial input on. Engineering decisions are in `DECISIONS.md`. Resolved items stay here with pointers so future agents do not reopen old questions by accident.

---

## Q1 — RESOLVED: Embedding provider for semantic search

Resolved 2026-05-23 in `DECISIONS.md`: production uses `voyage/voyage-3-large` through Vercel AI Gateway.

The schema stores `vector(1024)`, matching Voyage 3 large exactly. At the current curated-corpus size the full embedding run costs about $0.02, so quality and operational simplicity beat the earlier local-ONNX cost argument.

**Reopen if:** the multi-million-row local bulk DB needs embeddings. At that scale, local `bge-large-en-v1.5` becomes the cost-disciplined default again.

---

## Q2 — RESOLVED: Civilizational tag taxonomy (47 tags)

The hybrid region taxonomy assigns 0-3 civilizational tags per entity using the Vercel AI Gateway model configured in `lib/ai/index.ts`. The closed 47-tag list below is implemented in `lib/regions/civilizational-taxonomy.ts`; `scripts/tag-all.ts` applies it to the corpus.

### Proposed civilizational tags

**Sub-Saharan Africa**
- west-african-empires (Ghana, Mali, Songhai, Hausa, Yoruba, Asante)
- east-african-civilizations (Aksum, Swahili coast, Ethiopian highlands, Buganda)
- central-african-kingdoms (Kongo, Luba, Lunda)
- southern-african-civilizations (Great Zimbabwe, Mutapa, Zulu)
- bantu-expansion

**MENA / Persia / Caucasus**
- ancient-egypt
- mesopotamian-civilizations (Sumer, Akkad, Babylonia, Assyria)
- persian-empires (Achaemenid, Parthian, Sasanian, Safavid, Qajar)
- islamic-caliphates (Rashidun, Umayyad, Abbasid, Fatimid)
- ottoman-empire
- pre-islamic-arabia

**South Asia**
- indus-valley-civilization
- vedic-and-mauryan
- gupta-and-medieval-india
- delhi-sultanate-and-mughal
- southern-indian-empires (Chola, Vijayanagara, Pandyas)

**East Asia**
- early-china (Shang, Zhou, Qin, Han)
- imperial-china (Tang, Song, Yuan, Ming, Qing)
- imperial-japan (Asuka, Heian, Kamakura, Edo, Meiji)
- korean-kingdoms (Goguryeo, Silla, Goryeo, Joseon)
- mongol-empire-and-successors

**Southeast Asia / Oceania**
- southeast-asian-empires (Khmer, Srivijaya, Majapahit, Ayutthaya, Champa)
- polynesian-civilizations
- aboriginal-australian
- austronesian-expansion

**Steppe**
- steppe-empires (Scythians, Huns, Türks, Mongols, Timurids)

**Europe**
- bronze-age-aegean (Minoan, Mycenaean)
- classical-greece
- roman-republic-and-empire
- late-antique-and-byzantine
- medieval-europe
- early-modern-europe
- enlightenment-and-revolutions
- modern-europe

**Americas**
- mesoamerican-civilizations (Olmec, Maya, Teotihuacan, Mexica/Aztec)
- andean-civilizations (Caral, Moche, Wari, Inca)
- pre-columbian-north-american (Mississippian, Pueblo, Iroquois)
- caribbean-and-circum-caribbean
- colonial-americas
- post-colonial-americas

**Cross-cutting**
- silk-roads
- indian-ocean-trade
- trans-saharan-trade
- bronze-age-collapse
- age-of-sail-and-empire
- industrial-revolution
- world-wars-era

**Reopen if:** editorial review finds a missing civilization or an overlap that materially distorts the anti-Western-bias audit.

---

## Q3 — Stanford Encyclopedia of Philosophy license (CC BY-NC-SA)

SEP is CC BY-NC-SA. Non-commercial. Alexandria is now public on Vercel, so SEP-derived text is acceptable only while the project stays non-commercial and source attribution remains explicit.

**Action needed:** Confirm we never go commercial without first removing SEP-derived content, OR drop SEP from the source list and use only fully-permissive sources.

**Default until you say otherwise:** include SEP. Note in source attribution and `DECISIONS.md` that going commercial would require an SEP teardown.

---

## Q4 — Historical boundary layers (8+ across all continents)

The map now ships 8 hand-authored simplified GeoJSON layers in `public/historical-boundaries.geojson`.

Current layer list:
- Roman Empire (peak Trajan, c. 117 CE)
- Han Dynasty (c. 100 CE)
- Mongol Khanate (c. 1294 CE)
- Songhai Empire (c. 1550 CE)
- Inca Empire (c. 1525 CE)
- Maurya Empire (c. 250 BCE)
- Ottoman Empire (c. 1683 CE)
- Achaemenid Empire (c. 500 BCE)

**Action needed:** Decide whether Tokugawa Japan should be added as a ninth hand-authored layer or remain deferred.

---

## Q5 — Tier 0 entity count target after augmentation

Plan targets ~5M Tier 0 entities. Real number depends on how aggressive the regional augmentation pass is — could be 3M or 8M depending on per-bucket caps.

**Action needed:** Once I dry-run the seed filter on a sample of the Wikidata dump, I'll report estimated total + per-region distribution here, and you can adjust the caps.

---

## Q6 — RESOLVED: API key + budget raise

The pipeline uses `AI_GATEWAY_API_KEY`, not `ANTHROPIC_API_KEY`. Default budget remains `DAILY_BUDGET_USD=20` (hard cap), enforced by `pipeline/budget.ts`.

**Action needed:** Raise `DAILY_BUDGET_USD` only for intentional larger enrichment runs.

---

## Q7 — Wikidata + Wikipedia dump downloads (~80 GB compressed)

Bulk dumps are large. Download links:

- Wikidata JSON: `https://dumps.wikimedia.org/wikidatawiki/entities/latest-all.json.bz2` (~80 GB)
- Wikipedia XML: `https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-pages-articles-multistream.xml.bz2` (~22 GB)

**Action needed:** Confirm you want me to kick off the downloads (they're long; suggest `wget -c` so they're resumable; place into `./dumps/`). Or you do it manually. The streaming parsers consume directly from the `.bz2` files — no need to decompress.
