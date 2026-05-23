// Types, constants, and extractor helpers for the Wikidata JSON dump parser.
// Pure functions — no DB or filesystem side-effects. Imported by
// pipeline/bulk/import-wikidata-dump.ts and (later) by enrichment workers.

// ---------------------------------------------------------------------------
// Wikidata entity JSON shape (subset we care about)
// ---------------------------------------------------------------------------

export interface WdSitelink {
  site: string;
  title: string;
  badges?: string[];
  url?: string;
}

export interface WdLabel {
  language: string;
  value: string;
}

export interface WdMonolingual {
  text: string;
  language: string;
}

export type WdClaimRank = "deprecated" | "normal" | "preferred";

export interface WdSnak {
  snaktype: "value" | "novalue" | "somevalue";
  property: string;
  datatype?: string;
  datavalue?: {
    type: string;
    value: unknown;
  };
}

export interface WdClaim {
  mainsnak: WdSnak;
  qualifiers?: Record<string, WdSnak[]>;
  rank: WdClaimRank;
  type?: string;
}

export interface WdEntity {
  type: "item" | "property";
  id: string;
  labels?: Record<string, WdLabel>;
  descriptions?: Record<string, WdLabel>;
  aliases?: Record<string, WdLabel[]>;
  claims?: Record<string, WdClaim[]>;
  sitelinks?: Record<string, WdSitelink>;
}

// Common claim value shapes
export interface WdEntityIdValue {
  "entity-type": "item" | "property";
  "numeric-id": number;
  id: string; // "Q1048"
}

export interface WdTimeValue {
  time: string; // "+0049-07-12T00:00:00Z" or "-0044-03-15T00:00:00Z"
  precision: number; // 0-14
  before: number;
  after: number;
  timezone: number;
  calendarmodel: string;
}

export interface WdCoordinateValue {
  latitude: number;
  longitude: number;
  precision?: number | null;
  globe: string;
}

// ---------------------------------------------------------------------------
// Our entity-type enum (matches schema.ts entities.type)
// ---------------------------------------------------------------------------

export type EntityType =
  | "person"
  | "place"
  | "event"
  | "organization"
  | "work"
  | "concept";

// ---------------------------------------------------------------------------
// Seed filter constants
// ---------------------------------------------------------------------------

/**
 * P31 (instance of) values we accept for Tier 0 seed.
 * Lean toward inclusive — narrower types are subsumed by broader ones
 * (e.g., Q3957 town is a Q486972 settlement; both work).
 */
export const TYPE_WHITELIST = new Map<string, EntityType>([
  // --- person ---
  ["Q5", "person"], // human

  // --- place ---
  ["Q515", "place"], // city
  ["Q3957", "place"], // town
  ["Q532", "place"], // village
  ["Q486972", "place"], // human settlement
  ["Q5119", "place"], // capital
  ["Q1549591", "place"], // big city
  ["Q6256", "place"], // country
  ["Q3624078", "place"], // sovereign state
  ["Q15642541", "place"], // historical country
  ["Q3024240", "place"], // historical region
  ["Q839954", "place"], // archaeological site
  ["Q23397", "place"], // lake
  ["Q4022", "place"], // river
  ["Q8502", "place"], // mountain
  ["Q46831", "place"], // mountain range
  ["Q35509", "place"], // cave
  ["Q5107", "place"], // continent
  ["Q33837", "place"], // island
  ["Q47521", "place"], // strait
  ["Q165", "place"], // sea
  ["Q5798", "place"], // valley
  ["Q41176", "place"], // building
  ["Q24398318", "place"], // religious building
  ["Q23413", "place"], // castle
  ["Q33506", "place"], // museum
  ["Q16970", "place"], // church building
  ["Q44539", "place"], // temple
  ["Q3947", "place"], // house
  ["Q12280", "place"], // bridge
  ["Q12518", "place"], // tower
  ["Q4989906", "place"], // monument
  ["Q15661340", "place"], // ancient city
  ["Q133442", "place"], // ancient civilization
  ["Q655593", "place"], // capital of ancient civilization
  ["Q1907114", "place"], // ancient settlement

  // --- event ---
  ["Q178561", "event"], // battle
  ["Q198", "event"], // war
  ["Q1656682", "event"], // event
  ["Q294440", "event"], // public event
  ["Q11514315", "event"], // historical period
  ["Q3024240", "event"], // historical region (some periods filed here)
  ["Q645883", "event"], // military operation
  ["Q1259759", "event"], // military campaign
  ["Q464980", "event"], // siege
  ["Q3001412", "event"], // revolution
  ["Q124734", "event"], // revolt
  ["Q3839081", "event"], // disaster
  ["Q41397", "event"], // genocide
  ["Q15275719", "event"], // recurring event
  ["Q1190554", "event"], // occurrence
  ["Q13418847", "event"], // historical event
  ["Q12184", "event"], // pandemic
  ["Q3241045", "event"], // epidemic
  ["Q10931", "event"], // revolution
  ["Q1155622", "event"], // slave revolt
  ["Q1827102", "event"], // crusade
  ["Q17524420", "event"], // slave trade (specific)
  ["Q1128340", "concept"], // religious movement
  ["Q126288065", "concept"], // schism / reform movement
  ["Q727002", "concept"], // constitutional document
  ["Q93288", "concept"], // contract / charter
  ["Q3117863", "place"], // archaeological culture
  ["Q116795925", "concept"], // pre-Columbian civilization
  ["Q6266", "organization"], // confederation
  ["Q29428439", "organization"], // intergovernmental org variant
  ["Q2738074", "event"], // war of independence

  // --- organization ---
  ["Q43229", "organization"], // organization
  ["Q484170", "organization"], // commune
  ["Q484652", "organization"], // international organization
  ["Q4830453", "organization"], // business enterprise
  ["Q41710", "organization"], // ethnic group
  ["Q189538", "organization"], // dynasty
  ["Q3624078", "organization"], // sovereign state (also place)
  ["Q3918", "organization"], // university
  ["Q9174", "organization"], // religion
  ["Q1530705", "organization"], // government agency
  ["Q1799794", "organization"], // administrative territorial entity
  ["Q7210356", "organization"], // political organization
  ["Q7278", "organization"], // political party

  // --- work ---
  ["Q571", "work"], // book
  ["Q11424", "work"], // film
  ["Q482994", "work"], // album
  ["Q7889", "work"], // video game
  ["Q838948", "work"], // work of art
  ["Q179700", "work"], // statue
  ["Q860861", "work"], // sculpture
  ["Q5398426", "work"], // television series
  ["Q11032", "work"], // newspaper
  ["Q49084", "work"], // short story
  ["Q7725634", "work"], // literary work
  ["Q3331189", "work"], // version, edition, or translation
  ["Q105543609", "work"], // musical composition
  ["Q1344", "work"], // opera
  ["Q25379", "work"], // play
  ["Q34749", "work"], // myth
  ["Q780605", "work"], // poem (poetry)

  // --- concept (movements, ideas, technologies, religions, languages) ---
  ["Q179805", "concept"], // philosophical theory
  ["Q179805", "concept"], // philosophical movement
  ["Q1860557", "concept"], // school of thought
  ["Q2198855", "concept"], // cultural movement
  ["Q968159", "concept"], // art movement
  ["Q183356", "concept"], // ideology
  ["Q34770", "concept"], // language
  ["Q33742", "concept"], // natural language
  ["Q34228", "concept"], // alphabet
  ["Q9134", "concept"], // mythology
  ["Q179461", "concept"], // religion-specific
  ["Q1135737", "concept"], // historical concept
  ["Q11471", "concept"], // technology
  ["Q1183543", "concept"], // device
  ["Q2424752", "concept"], // product
  ["Q11042", "concept"], // culture
  ["Q42883", "concept"], // culture (alt)
  ["Q105648", "place"], // civilization
  ["Q1138571", "place"], // trade route
  ["Q405155", "place"], // trade route (alt label)
  ["Q445741", "place"], // historic road
  ["Q601401", "concept"], // trade
  ["Q44512", "concept"], // disease

  // Historical phenomena / processes (came up in seed-batch-4)
  ["Q3042783", "event"], // societal collapse
  ["Q49367", "event"], // ice age
  ["Q6957341", "concept"], // Indian religion (Sikhism P31)
  ["Q32090", "concept"], // lifestyle (catches some religion entries)
]);

/**
 * Wiki sitelink codes for European-language Wikipedias.
 * Filter logic: an entity must have ≥1 sitelink whose lang code is NOT in
 * this set. This corrects the en-wiki bias built into "has Wikipedia article".
 *
 * Includes constructed languages (eo, vo, ie, io) which historically derive
 * from European linguistic spheres. Excludes Russian-influenced Central Asian
 * languages (kk, uz, ky, tg, tk) — those count as non-European.
 */
export const EUROPEAN_WIKIS = new Set<string>([
  // Major
  "en", "fr", "de", "es", "it", "pt", "nl", "ru", "pl", "sv",
  "no", "nn", "nb", "da", "fi", "cs", "sk", "hu", "ro", "bg",
  "el", "ca", "gl", "eu", "uk", "be", "be-tarask", "hr", "sr", "sh",
  "sl", "mk", "bs", "et", "lv", "lt", "sq", "mt", "is", "ga",
  "gd", "cy", "br", "oc", "la",
  // Regional / minority
  "ast", "an", "co", "lb", "li", "frp", "fur", "scn", "vec", "nap",
  "lij", "pms", "lmo", "rm", "als", "gsw", "fy", "sco", "ang", "fo",
  "yi", "ksh", "bar", "stq", "nds", "nds-nl", "nrm", "wa", "vls", "zea",
  "diq", // Zazaki — geographically Anatolia but linguistically IE
  // Constructed (historically European-rooted)
  "eo", "vo", "ie", "io", "ia", "jbo", "nov", "lfn",
]);

/**
 * Non-language wiki keys to skip when counting sitelinks
 * (these aren't language Wikipedias).
 */
export const NON_LANGUAGE_WIKI_KEYS = new Set<string>([
  "commons", "commonswiki", "meta", "metawiki", "wikidata",
  "wikidatawiki", "species", "specieswiki", "mediawiki",
  "mediawikiwiki", "incubator", "wikimania",
]);

export const MIN_SITELINKS = 3;

/**
 * Wikidata properties we extract as relationships. Curated for narrative
 * relevance — adding more is cheap, but each adds graph density.
 */
export const REL_PROPERTIES = new Set<string>([
  // Structural
  "P361", // part of
  "P527", // has part
  "P31", // instance of (kept for graph traversal)
  "P279", // subclass of

  // Person — family
  "P22", // father
  "P25", // mother
  "P40", // child
  "P26", // spouse
  "P3373", // sibling

  // Person — identity & affiliation
  "P27", // country of citizenship
  "P19", // place of birth
  "P20", // place of death
  "P106", // occupation
  "P102", // member of political party
  "P140", // religion
  "P39", // position held
  "P69", // educated at
  "P108", // employer
  "P166", // award received

  // Creative works
  "P50", // author
  "P57", // director
  "P162", // producer
  "P175", // performer
  "P98", // editor
  "P98", // publisher
  "P407", // language of work
  "P136", // genre

  // Organizations
  "P127", // owned by
  "P112", // founded by
  "P749", // parent organization
  "P355", // subsidiary
  "P137", // operator

  // Events
  "P607", // conflict (battle in war)
  "P710", // participant
  "P823", // speaker

  // Geography
  "P17", // country
  "P30", // continent
  "P276", // location
  "P131", // located in administrative entity

  // Temporal
  "P155", // follows
  "P156", // followed by
  "P361", // part of (period)
]);

// ---------------------------------------------------------------------------
// Extractor helpers
// ---------------------------------------------------------------------------

const SITELINK_PATTERN = /^([a-z][a-z0-9-]{1,15})wiki$/;

/**
 * Pick the best (non-deprecated, preferred-first) claim for a property.
 * Returns the mainsnak.datavalue.value or null.
 */
export function getBestClaimValue<T = unknown>(
  claims: Record<string, WdClaim[]> | undefined,
  prop: string,
): T | null {
  if (!claims) return null;
  const arr = claims[prop];
  if (!arr || arr.length === 0) return null;

  const usable = arr.filter(
    (c) => c.rank !== "deprecated" && c.mainsnak.snaktype === "value",
  );
  if (usable.length === 0) return null;

  const preferred = usable.find((c) => c.rank === "preferred") ?? usable[0];
  return (preferred?.mainsnak.datavalue?.value as T) ?? null;
}

/**
 * Get all non-deprecated claim values for a property.
 */
export function getAllClaimValues<T = unknown>(
  claims: Record<string, WdClaim[]> | undefined,
  prop: string,
): T[] {
  if (!claims) return [];
  const arr = claims[prop];
  if (!arr) return [];

  return arr
    .filter((c) => c.rank !== "deprecated" && c.mainsnak.snaktype === "value")
    .map((c) => c.mainsnak.datavalue?.value as T)
    .filter((v): v is T => v != null);
}

/**
 * Map P31 claims to our EntityType enum.
 * Picks the most specific type from the whitelist (first matching wins,
 * since the whitelist is ordered specific-to-general within each category).
 */
export function getEntityType(
  claims: Record<string, WdClaim[]> | undefined,
): EntityType | null {
  const p31Values = getAllClaimValues<WdEntityIdValue>(claims, "P31");
  for (const v of p31Values) {
    const t = TYPE_WHITELIST.get(v.id);
    if (t) return t;
  }
  return null;
}

/**
 * Parse a Wikidata time string + precision into a year integer.
 * Negative years are BCE. Decade/century/millennium precisions snap the year.
 */
export function parseWikidataTime(
  timeStr: string,
  precision: number,
): { year: number; precisionLabel: string } | null {
  const match = timeStr.match(/^([+-])(\d+)-/);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const rawYear = parseInt(match[2] ?? "0", 10);
  if (!Number.isFinite(rawYear)) return null;
  let year = sign * rawYear;

  let precisionLabel: string;
  if (precision >= 11) precisionLabel = "day";
  else if (precision === 10) precisionLabel = "month";
  else if (precision === 9) precisionLabel = "year";
  else if (precision === 8) {
    precisionLabel = "decade";
    year = Math.floor(year / 10) * 10;
  } else if (precision === 7) {
    precisionLabel = "century";
    year = Math.floor(year / 100) * 100;
  } else if (precision === 6) {
    precisionLabel = "millennium";
    year = Math.floor(year / 1000) * 1000;
  } else if (precision >= 0 && precision <= 5) {
    // Geologic / pre-historic precision. Skip — out of our scope.
    return null;
  } else {
    precisionLabel = "year";
  }

  // Sanity: clamp to a plausible historical range.
  if (year < -10_000 || year > 3000) return null;

  return { year, precisionLabel };
}

/**
 * Find date_start (birth / inception / start_time) and date_end (death /
 * dissolution / end_time) based on entity type semantics.
 */
export function getDates(
  claims: Record<string, WdClaim[]> | undefined,
  type: EntityType,
): {
  dateStart: number | null;
  dateStartPrecision: string | null;
  dateEnd: number | null;
  dateEndPrecision: string | null;
} {
  const startProps =
    type === "person"
      ? ["P569"] // birth
      : type === "event"
        ? ["P580", "P571"] // start time, inception
        : ["P571", "P580"]; // inception, start time
  const endProps =
    type === "person"
      ? ["P570"] // death
      : type === "event"
        ? ["P582", "P576"] // end time, dissolved
        : ["P576", "P582"]; // dissolved, end time

  const out = {
    dateStart: null as number | null,
    dateStartPrecision: null as string | null,
    dateEnd: null as number | null,
    dateEndPrecision: null as string | null,
  };

  for (const p of startProps) {
    const v = getBestClaimValue<WdTimeValue>(claims, p);
    if (!v) continue;
    const parsed = parseWikidataTime(v.time, v.precision);
    if (parsed) {
      out.dateStart = parsed.year;
      out.dateStartPrecision = parsed.precisionLabel;
      break;
    }
  }
  for (const p of endProps) {
    const v = getBestClaimValue<WdTimeValue>(claims, p);
    if (!v) continue;
    const parsed = parseWikidataTime(v.time, v.precision);
    if (parsed) {
      out.dateEnd = parsed.year;
      out.dateEndPrecision = parsed.precisionLabel;
      break;
    }
  }

  return out;
}

/**
 * Extract latitude / longitude from P625.
 */
export function getCoordinates(
  claims: Record<string, WdClaim[]> | undefined,
): { latitude: number; longitude: number } | null {
  const v = getBestClaimValue<WdCoordinateValue>(claims, "P625");
  if (!v) return null;
  if (
    typeof v.latitude !== "number" ||
    typeof v.longitude !== "number" ||
    !Number.isFinite(v.latitude) ||
    !Number.isFinite(v.longitude)
  ) {
    return null;
  }
  // We only care about Earth coordinates.
  if (v.globe && !v.globe.endsWith("Q2")) return null;
  return { latitude: v.latitude, longitude: v.longitude };
}

/**
 * Get the primary display name. Prefer English; fall back to the first
 * available label.
 */
export function getName(
  labels: Record<string, WdLabel> | undefined,
): string | null {
  if (!labels) return null;
  const en = labels.en?.value;
  if (en) return en;
  for (const key of Object.keys(labels)) {
    const v = labels[key]?.value;
    if (v) return v;
  }
  return null;
}

/**
 * Bare slug: lowercase, ASCII, dash-separated, capped at 80 chars.
 * Empty string for names that yield nothing (pure non-Latin scripts).
 */
export function baseSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Always-unique slug for use at insert time. Pairs the base slug with
 * the QID so collisions are impossible at insert. The rebuild-slugs
 * script later promotes uncontested base slugs to their bare form
 * (e.g., "julius-caesar-q1048" → "julius-caesar"); contested ones keep
 * the QID suffix.
 */
export function makeSlug(name: string, qid: string): string {
  const base = baseSlug(name);
  return base ? `${base}-${qid.toLowerCase()}` : qid.toLowerCase();
}

/**
 * Extract aliases. Combines explicit aliases + labels in other languages.
 * Deduped by (alias, language).
 */
export function getAliases(
  labels: Record<string, WdLabel> | undefined,
  aliases: Record<string, WdLabel[]> | undefined,
  primaryName: string,
): Array<{ alias: string; language: string }> {
  const out = new Map<string, { alias: string; language: string }>();

  if (aliases) {
    for (const [lang, arr] of Object.entries(aliases)) {
      for (const a of arr) {
        if (!a?.value) continue;
        if (a.value === primaryName) continue;
        const key = `${a.value}::${lang}`;
        if (!out.has(key)) out.set(key, { alias: a.value, language: lang });
      }
    }
  }
  // Also include non-English labels as aliases (multilingual search)
  if (labels) {
    for (const [lang, l] of Object.entries(labels)) {
      if (lang === "en") continue;
      if (!l?.value) continue;
      if (l.value === primaryName) continue;
      const key = `${l.value}::${lang}`;
      if (!out.has(key)) out.set(key, { alias: l.value, language: lang });
    }
  }
  return [...out.values()];
}

/**
 * Extract relationships in our shape. Only properties in REL_PROPERTIES are
 * kept, and the target value must be a Wikidata QID.
 */
export function getRelationships(
  claims: Record<string, WdClaim[]> | undefined,
  sourceQid: string,
): Array<{
  sourceQid: string;
  targetQid: string;
  predicate: string;
  qualifiers: Record<string, unknown> | null;
}> {
  if (!claims) return [];
  const out: ReturnType<typeof getRelationships> = [];

  for (const prop of Object.keys(claims)) {
    if (!REL_PROPERTIES.has(prop)) continue;
    const arr = claims[prop];
    if (!arr) continue;
    for (const c of arr) {
      if (c.rank === "deprecated") continue;
      if (c.mainsnak.snaktype !== "value") continue;
      const val = c.mainsnak.datavalue?.value as WdEntityIdValue | undefined;
      if (!val || typeof val.id !== "string" || !val.id.startsWith("Q")) {
        continue;
      }
      out.push({
        sourceQid,
        targetQid: val.id,
        predicate: prop,
        qualifiers: c.qualifiers ? { ...c.qualifiers } : null,
      });
    }
  }
  return out;
}

/**
 * Apply the Tier 0 seed filter.
 * Returns the EntityType if accepted, or null if rejected.
 *
 * Rules:
 *  1. P31 must include at least one type in TYPE_WHITELIST.
 *  2. At least MIN_SITELINKS language-wiki sitelinks.
 *  3. At least one sitelink in a non-European wiki.
 */
export function passesSeedFilter(entity: WdEntity): EntityType | null {
  if (entity.type !== "item") return null;

  const type = getEntityType(entity.claims);
  if (!type) return null;

  const sitelinks = entity.sitelinks ?? {};
  let langWikiCount = 0;
  let hasNonEuropean = false;

  for (const key of Object.keys(sitelinks)) {
    if (NON_LANGUAGE_WIKI_KEYS.has(key)) continue;
    const m = key.match(SITELINK_PATTERN);
    if (!m) continue;
    const lang = m[1]!;
    langWikiCount += 1;
    if (!EUROPEAN_WIKIS.has(lang)) {
      hasNonEuropean = true;
    }
  }

  if (langWikiCount < MIN_SITELINKS) return null;
  if (!hasNonEuropean) return null;
  return type;
}

/**
 * Get the P17 (country) target QID, used later for UN subregion derivation.
 */
export function getCountryQid(
  claims: Record<string, WdClaim[]> | undefined,
): string | null {
  const v = getBestClaimValue<WdEntityIdValue>(claims, "P17");
  return v?.id ?? null;
}
