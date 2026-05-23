# Open Questions

Items I need editorial input on. Engineering decisions are in `DECISIONS.md`. Anything that requires your taste, your budget, or your knowledge of a specific historical claim goes here.

---

## Q1 — Embedding provider for semantic search

Anthropic has no first-party embeddings API. Three options:

| Option | Cost (5M entities × ~200 tokens) | Notes |
|---|---|---|
| **Local `bge-large-en-v1.5` via Transformers.js / ONNX** | $0 | Runs on laptop CPU/MPS. Slower per-call but no per-request cost. **Recommended for cost discipline.** |
| Voyage `voyage-3-large` | ~$180 | Anthropic-recommended for embedding. 1024-dim. |
| OpenAI `text-embedding-3-large` | ~$130 | 3072-dim (downsample to 1024 ours). Mature. |

The schema currently reserves `vector(1024)`. Local bge-large is 1024-dim, Voyage is 1024, OpenAI is 3072 (truncated).

**Default until you say otherwise:** local bge-large via ONNX. Switch to Voyage if quality bites.

---

## Q2 — Civilizational tag taxonomy (~40 tags)

The hybrid region taxonomy assigns 0–3 civilizational tags per entity using a Haiku-based classifier. The classifier needs a fixed tag list. Draft proposed below — please review, edit, and approve before I run bulk tagging (task #6).

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

**Action needed:** Edit this list. Add tags I missed. Cut overlaps. Once you approve, I freeze it and tag the corpus.

---

## Q3 — Stanford Encyclopedia of Philosophy license (CC BY-NC-SA)

SEP is CC BY-NC-SA. Non-commercial. The local-only nature of the project keeps us safely in the NC bucket.

**Action needed:** Confirm we never go commercial without first removing SEP-derived content, OR drop SEP from the source list and use only fully-permissive sources.

**Default until you say otherwise:** include SEP. Note in source attribution and `DECISIONS.md` that going commercial would require an SEP teardown.

---

## Q4 — Historical boundary layers (8+ across all continents)

The map needs at least 8 historical boundary layers spanning all continents. OpenHistoricalMap covers a lot but not everything. Need to confirm coverage for each priority civilization.

Priority list:
- Roman Empire (peak Trajan, c. 117 CE)
- Han Dynasty (c. 87 BCE)
- Mongol Khanate (c. 1294 CE)
- Songhai Empire (c. 1550 CE)
- Inca Empire (c. 1525 CE)
- Tokugawa Japan (c. 1700 CE)
- Maurya Empire (c. 250 BCE)
- Ottoman Empire (c. 1683 CE)

**Action needed:** I will survey OpenHistoricalMap coverage when I get to the map task. If any of these are missing, I will flag them here and we will decide whether to hand-author GeoJSON or pick a substitute civilization.

---

## Q5 — Tier 0 entity count target after augmentation

Plan targets ~5M Tier 0 entities. Real number depends on how aggressive the regional augmentation pass is — could be 3M or 8M depending on per-bucket caps.

**Action needed:** Once I dry-run the seed filter on a sample of the Wikidata dump, I'll report estimated total + per-region distribution here, and you can adjust the caps.

---

## Q6 — API key + budget raise

The pipeline cannot run Tier 1+ enrichment until `ANTHROPIC_API_KEY` is set in `.env.local`. Default budget is `DAILY_BUDGET_USD=20` (hard cap).

**Action needed:** Set the API key when you're ready to start enrichment. Raise the budget anytime — it's a single env var change.

---

## Q7 — Wikidata + Wikipedia dump downloads (~80 GB compressed)

Bulk dumps are large. Download links:

- Wikidata JSON: `https://dumps.wikimedia.org/wikidatawiki/entities/latest-all.json.bz2` (~80 GB)
- Wikipedia XML: `https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-pages-articles-multistream.xml.bz2` (~22 GB)

**Action needed:** Confirm you want me to kick off the downloads (they're long; suggest `wget -c` so they're resumable; place into `./dumps/`). Or you do it manually. The streaming parsers consume directly from the `.bz2` files — no need to decompress.
