// Fetch a pre-1924 public-domain text from the Internet Archive as a
// third source for Tier 2 narration. Pre-1924 cleared US copyright in
// 2019; we restrict to that window to stay licence-clean without
// per-item rights checks.
//
// Strategy:
//   1. IA advancedsearch.php — title + (for persons) surname-based query
//      against `mediatype:texts AND year:[1700 TO 1923] AND language:eng`,
//      sorted by downloads desc. Downloads is a noisy but useful proxy
//      for "real scholarship vs. obscure pamphlet."
//   2. Score candidates by title-match + downloads, dock US local-history
//      junk titles ("History of Jasper County, Missouri"). Same shape as
//      the wikisource scorer.
//   3. Fetch the first usable candidate's djvu plaintext from
//      /download/{id}/{id}_djvu.txt; strip leading title-page noise.
//
// Coverage caveats: pre-1924 English-only is heavily Eurocentric (good
// for Greco-Roman, European, classical antiquity; poor for non-Western
// post-Britannica subjects). Non-English IA holdings — especially
// French and German colonial-era scholarship on Africa and Asia — are
// out of scope for this pass; opening them needs translation or trust
// in the model's multilingual handling, see the integrations plan.
// Null returns are the honest answer for entities with no fit, not a
// failure: narrate.ts treats null the same way it treats a Wikisource
// miss — fall back to fewer sources.

const UA =
  process.env.WIKIMEDIA_USER_AGENT ??
  "Alexandria/0.1 (local development; contact: andrestran@icloud.com)";

export interface IAArticle {
  identifier: string;
  title: string;
  url: string;
  text: string;
  license: "Public domain";
  language: string;
  year: number | null;
  creator?: string;
}

export type EntityHintType =
  | "person"
  | "place"
  | "event"
  | "organization"
  | "work"
  | "concept";

// US local-history titles dominate IA's pre-1924 English corpus and will
// match short entity names like "Hannibal" or "Cleopatra" via county-seat
// town names. Dock hard when the title looks like one of these.
const LOCAL_HISTORY_PENALTY_TERMS = [
  "missouri", "ohio", "iowa", "illinois", "indiana", "kansas",
  "michigan", "minnesota", "pennsylvania", "virginia", "texas",
  "tennessee", "kentucky", "alabama", "georgia",
  "county", "townships", "biographical sketches",
];

interface IASearchDoc {
  identifier: string;
  title: string;
  creator?: string | string[];
  date?: string;
  description?: string | string[];
  language?: string | string[];
  downloads?: number;
}

interface IASearchResponse {
  response?: {
    docs?: IASearchDoc[];
    numFound?: number;
  };
}

async function searchCandidates(
  name: string,
  hint?: EntityHintType,
): Promise<IASearchDoc[]> {
  const escapedName = name.replace(/"/g, '\\"');
  const queries: string[] = [`title:"${escapedName}"`];

  // For persons, also try surname-only (Britannica + IA biographies often
  // use just the surname as title: "Hannibal", "Caesar", "Charlemagne").
  if (hint === "person") {
    const tokens = name.trim().split(/\s+/);
    if (tokens.length >= 2) {
      const surname = tokens[tokens.length - 1]!.replace(/"/g, '\\"');
      queries.push(`title:"${surname}"`);
    }
  }

  // Subject fallback — catches general-history texts that mention the
  // entity in their LOC subject tags without naming it in the title.
  queries.push(`subject:"${escapedName}"`);

  const seen = new Set<string>();
  const out: IASearchDoc[] = [];
  for (const q of queries) {
    const fullQ = `(${q}) AND mediatype:texts AND year:[1700 TO 1923] AND language:eng`;
    const params = new URLSearchParams({
      q: fullQ,
      fl: "identifier,title,creator,date,description,language,downloads",
      output: "json",
      rows: "10",
      sort: "downloads desc",
    });
    const url = `https://archive.org/advancedsearch.php?${params.toString()}`;
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) continue;
    const j = (await r.json()) as IASearchResponse;
    for (const d of j.response?.docs ?? []) {
      if (!d.identifier || seen.has(d.identifier)) continue;
      seen.add(d.identifier);
      out.push(d);
    }
    if (out.length >= 15) break;
  }
  return out;
}

function wordBoundaryRe(s: string): RegExp {
  // Escape regex metacharacters and wrap in \b…\b.
  const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`);
}

function scoreCandidate(
  doc: IASearchDoc,
  name: string,
  hint?: EntityHintType,
): number {
  if (!doc.title) return 0;
  const titleLower = doc.title.toLowerCase();
  const nameLower = name.toLowerCase();
  const tokens = nameLower.split(/\s+/).filter((t) => t.length > 0);
  let score = 0;

  // Word-boundary full-name presence is the load-bearing signal — it
  // disambiguates "Mansa Musa" from books that just happen to contain
  // "Musa" (the surname is too common as a substring on its own).
  const fullNameRe = wordBoundaryRe(nameLower);
  const fullNamePresent = fullNameRe.test(titleLower);

  if (titleLower === nameLower) score += 100;
  else if (titleLower.startsWith(nameLower + " ")) score += 80;
  else if (titleLower.startsWith(nameLower + ":")) score += 80;
  else if (titleLower.startsWith(nameLower + ",")) score += 80;
  else if (fullNamePresent) score += 50;

  // Primary-subject bonus: did the name appear BEFORE the first colon/
  // semicolon in the title? Catches "Einhard's life of Charlemagne :
  // …" while penalising "Bulfinch's mythology : … ; Legends of
  // Charlemagne" where the name is only in the appendix.
  const primarySegment = titleLower.split(/[:;]/)[0]!.trim();
  if (fullNamePresent && fullNameRe.test(primarySegment)) score += 20;

  // Short single-token names (≤ 8 chars) match too many unrelated
  // substrings — "Acre" → "Owners of land of one acre", "Augustus" →
  // "Letters of Colonel Sir Augustus Simon Frazer". For these, require
  // the name to sit at the head of the title (modulo leading articles)
  // or it doesn't count.
  if (tokens.length === 1 && tokens[0]!.length <= 8) {
    const head = titleLower.replace(/^(the\s+|a\s+|an\s+)+/, "");
    const headsWithName =
      head === tokens[0] ||
      head.startsWith(tokens[0] + " ") ||
      head.startsWith(tokens[0] + ":") ||
      head.startsWith(tokens[0] + ",") ||
      head.startsWith(tokens[0] + "'");
    if (!headsWithName) {
      // Cap below the 30-point selection threshold so mid-title matches
      // on short common-word names get filtered out.
      score = Math.min(score, 25);
    }
  }

  // Surname fallback for persons: only credit it when the FULL name also
  // appears somewhere (title + subtitle, often). Surname-only matches
  // are off — a single-token surname like "Musa" matches too many
  // unrelated 19th-century pamphlets. The exact-equals branch needs
  // the same guard or it bypasses the rule (CodeRabbit catch on PR #6).
  if (hint === "person" && tokens.length >= 2) {
    const surname = tokens[tokens.length - 1]!;
    const surnameRe = wordBoundaryRe(surname);
    if (surnameRe.test(titleLower) && fullNamePresent) {
      score += titleLower === surname ? 60 : 15;
    }
  }

  // Downloads as a quality/relevance proxy — only credit when there's
  // already a real title signal, otherwise popular-but-irrelevant
  // titles can clear the threshold on downloads alone.
  if (score > 0 && typeof doc.downloads === "number" && doc.downloads > 0) {
    score += Math.min(20, Math.floor(Math.log10(doc.downloads + 1) * 5));
  }

  // Penalty for US local-history titles (dominant in IA's pre-1924
  // English corpus; would otherwise win on short entity names like
  // "Hannibal" via "History of Jasper County, Missouri").
  for (const term of LOCAL_HISTORY_PENALTY_TERMS) {
    if (titleLower.includes(term)) {
      score -= 80;
      break;
    }
  }

  return score;
}

/**
 * Fetch raw djvu OCR plaintext for an IA item and trim leading title-page
 * noise. Returns null if the download fails or the result is implausibly
 * short.
 */
async function fetchPlaintext(
  identifier: string,
  maxChars: number = 9000,
): Promise<string | null> {
  const url =
    `https://archive.org/download/${encodeURIComponent(identifier)}/` +
    `${encodeURIComponent(identifier)}_djvu.txt`;
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/plain" },
    redirect: "follow",
  });
  if (!r.ok) return null;
  const raw = await r.text();
  if (raw.length < 1500) return null;

  // OCR title pages are dense with spaced-out capitals, repeated dots, and
  // OCR artifacts. The actual book body starts somewhere in the first
  // few thousand chars. Heuristic: skip an early chunk proportional to
  // text length (5%, capped at 1500 chars) to get past the front matter
  // without losing too much narrative text.
  const skip = Math.min(1500, Math.floor(raw.length * 0.05));
  let body = raw.slice(skip);

  // Collapse runs of whitespace and broken OCR hyphenations
  // ("Carthag- inian" → "Carthaginian").
  body = body
    .replace(/-\n\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (body.length < 800) return null;
  return body.slice(0, maxChars);
}

/**
 * Look up a pre-1924 public-domain Internet Archive text for the entity.
 * Returns null if no usable match is found.
 */
export async function fetchInternetArchive(
  entityName: string,
  hint?: EntityHintType,
): Promise<IAArticle | null> {
  const candidates = await searchCandidates(entityName, hint);
  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((d) => ({ doc: d, score: scoreCandidate(d, entityName, hint) }))
    .filter((c) => c.score >= 30)
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return null;

  for (const { doc } of ranked.slice(0, 3)) {
    const text = await fetchPlaintext(doc.identifier);
    if (text && text.length > 800) {
      const yearStr = doc.date?.slice(0, 4);
      const year = yearStr && /^\d{4}$/.test(yearStr) ? parseInt(yearStr, 10) : null;
      const language = Array.isArray(doc.language)
        ? (doc.language[0] ?? "eng")
        : (doc.language ?? "eng");
      const creator = Array.isArray(doc.creator) ? doc.creator[0] : doc.creator;
      return {
        identifier: doc.identifier,
        title: doc.title,
        url: `https://archive.org/details/${doc.identifier}`,
        text,
        license: "Public domain",
        language,
        year,
        creator,
      };
    }
  }
  return null;
}
