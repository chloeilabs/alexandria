// Closed civilizational-tag taxonomy. Each entity is classified into
// 0-3 of these tags by the tag.ts worker. List is intentionally
// global and lean toward non-Western buckets (see DECISIONS.md).
//
// Editorially this is a draft list — it's documented in
// OPEN_QUESTIONS.md and may be edited before being locked.

export const CIVILIZATIONAL_TAGS = [
  // --- Sub-Saharan Africa ---
  "west-african-empires",
  "east-african-civilizations",
  "central-african-kingdoms",
  "southern-african-civilizations",
  "bantu-expansion",

  // --- MENA / Persia / Caucasus ---
  "ancient-egypt",
  "mesopotamian-civilizations",
  "persian-empires",
  "islamic-caliphates",
  "ottoman-empire",
  "pre-islamic-arabia",

  // --- South Asia ---
  "indus-valley-civilization",
  "vedic-and-mauryan",
  "gupta-and-medieval-india",
  "delhi-sultanate-and-mughal",
  "southern-indian-empires",

  // --- East Asia ---
  "early-china",
  "imperial-china",
  "imperial-japan",
  "korean-kingdoms",
  "mongol-empire-and-successors",

  // --- Southeast Asia / Oceania ---
  "southeast-asian-empires",
  "polynesian-civilizations",
  "aboriginal-australian",
  "austronesian-expansion",

  // --- Steppe ---
  "steppe-empires",

  // --- Europe ---
  "bronze-age-aegean",
  "classical-greece",
  "roman-republic-and-empire",
  "late-antique-and-byzantine",
  "medieval-europe",
  "early-modern-europe",
  "enlightenment-and-revolutions",
  "modern-europe",

  // --- Americas ---
  "mesoamerican-civilizations",
  "andean-civilizations",
  "pre-columbian-north-american",
  "caribbean-and-circum-caribbean",
  "colonial-americas",
  "post-colonial-americas",

  // --- Cross-cutting ---
  "silk-roads",
  "indian-ocean-trade",
  "trans-saharan-trade",
  "bronze-age-collapse",
  "age-of-sail-and-empire",
  "industrial-revolution",
  "world-wars-era",
] as const;

export type CivilizationalTag = (typeof CIVILIZATIONAL_TAGS)[number];

/**
 * One-line descriptions to give the classifier just enough to disambiguate.
 * The model gets this entire block in the prompt; keep concise.
 */
export const TAG_DESCRIPTIONS: Record<CivilizationalTag, string> = {
  "west-african-empires":
    "Ghana, Mali, Songhai, Hausa, Yoruba, Asante; Sahelian empires and West African states",
  "east-african-civilizations":
    "Aksum, Swahili coast, Ethiopian highlands, Buganda, Nubia",
  "central-african-kingdoms": "Kongo, Luba, Lunda, Kanem-Bornu",
  "southern-african-civilizations":
    "Great Zimbabwe, Mutapa, Zulu kingdom, Tswana, Sotho",
  "bantu-expansion":
    "Linguistic and demographic spread of Bantu-speaking peoples across SS Africa",
  "ancient-egypt":
    "Dynastic Egypt from Old Kingdom through Ptolemaic period, ~3100 BCE-30 BCE",
  "mesopotamian-civilizations":
    "Sumer, Akkad, Babylonia, Assyria, Elam — the Tigris-Euphrates basin",
  "persian-empires":
    "Achaemenid, Parthian, Sasanian, Safavid, Qajar — successive Iranian empires",
  "islamic-caliphates":
    "Rashidun, Umayyad, Abbasid, Fatimid; Islamic golden age and its scholars",
  "ottoman-empire":
    "Ottoman state from late-13th c. to 1922; Turkish/Anatolian sphere",
  "pre-islamic-arabia": "South Arabian kingdoms, Nabataeans, Lakhmids, Ghassanids",
  "indus-valley-civilization":
    "Harappan and Mohenjo-Daro era cities, ~2600-1900 BCE",
  "vedic-and-mauryan":
    "Vedic period through Maurya empire (~1500-185 BCE), including Ashoka and early Buddhism",
  "gupta-and-medieval-india":
    "Gupta, Pala, Chola dynasties; classical and medieval north Indian states",
  "delhi-sultanate-and-mughal":
    "Delhi Sultanate and Mughal empire of the Indian subcontinent, 1206-1857",
  "southern-indian-empires":
    "Chola, Pandya, Vijayanagara, Hoysala — peninsular Indian states",
  "early-china":
    "Shang, Zhou, Qin, Han dynasties; pre-Tang Chinese civilization",
  "imperial-china":
    "Tang, Song, Yuan, Ming, Qing dynasties; post-Han imperial China",
  "imperial-japan":
    "Asuka, Heian, Kamakura, Muromachi, Edo, Meiji eras",
  "korean-kingdoms":
    "Goguryeo, Silla, Baekje, Goryeo, Joseon",
  "mongol-empire-and-successors":
    "Genghis Khan's empire and the Yuan/Ilkhanate/Golden Horde/Chagatai successor states",
  "southeast-asian-empires":
    "Khmer, Srivijaya, Majapahit, Ayutthaya, Champa, Pagan, Sukhothai",
  "polynesian-civilizations":
    "Hawaiian, Maori, Tongan, Samoan, Tahitian, Rapa Nui societies",
  "aboriginal-australian":
    "Pre-1788 Aboriginal Australian peoples and Torres Strait Islanders",
  "austronesian-expansion":
    "Maritime spread of Austronesian-speaking peoples across the Indian and Pacific oceans",
  "steppe-empires":
    "Scythians, Xiongnu, Huns, Türk khaganate, Mongols, Timurids — Eurasian steppe powers",
  "bronze-age-aegean": "Minoan and Mycenaean civilizations, ~3000-1100 BCE",
  "classical-greece":
    "Archaic and Classical Greek city-states + Hellenistic kingdoms after Alexander",
  "roman-republic-and-empire":
    "Roman state from founding through the Western collapse, ~509 BCE-476 CE",
  "late-antique-and-byzantine":
    "Byzantine/Eastern Roman Empire from Constantine through 1453",
  "medieval-europe":
    "Western Europe roughly 500-1500 CE; Carolingian, feudal, high medieval",
  "early-modern-europe":
    "Renaissance, Reformation, Age of Discovery, 1500-1789",
  "enlightenment-and-revolutions":
    "European Enlightenment, American/French/Latin American revolutions, 1750-1850",
  "modern-europe":
    "European industrial era through present, 1850-",
  "mesoamerican-civilizations":
    "Olmec, Maya, Teotihuacan, Toltec, Mexica/Aztec, Mixtec, Zapotec",
  "andean-civilizations":
    "Caral, Chavín, Moche, Wari, Tiwanaku, Inca empire of the Andes",
  "pre-columbian-north-american":
    "Mississippian, Pueblo, Ancestral Puebloan, Hopewell, Iroquois, Cahokia",
  "caribbean-and-circum-caribbean":
    "Taíno, Carib, Arawak peoples; pre- and post-contact Caribbean",
  "colonial-americas":
    "Spanish, Portuguese, English, French colonial empires in the Americas, 1492-c.1825",
  "post-colonial-americas":
    "Independent American republics and Indigenous resistance, 1810-",
  "silk-roads":
    "Trans-Eurasian overland trade routes connecting China, Central Asia, Persia, India, Mediterranean",
  "indian-ocean-trade":
    "Maritime trade network linking E. Africa, Arabia, India, SE Asia, and China",
  "trans-saharan-trade":
    "Caravan networks across the Sahara linking Mediterranean and Sahelian/West African states",
  "bronze-age-collapse":
    "Systemic collapse c. 1200 BCE of LBA Mediterranean and Near Eastern civilizations",
  "age-of-sail-and-empire":
    "European maritime expansion and global colonization, c. 1500-1900",
  "industrial-revolution":
    "Mechanization, urbanization, capitalism in Britain and beyond, 1760-1900",
  "world-wars-era":
    "WWI, WWII, interwar period, and immediate aftermath, 1914-1950",
};
