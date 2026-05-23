// Fetch 1911 Encyclopædia Britannica articles from Wikisource as a
// second source for Tier 2 narration. Public-domain (US copyright on
// the 1911 edition expired in 1986); free to remix into our own prose.
//
// Title-matching strategy:
//   1. Try the entity's verbatim name as the article slug.
//   2. If 404, search Wikisource scoped to 1911-Britannica pages.
//      Pick the candidate whose article slug (the part after the
//      "1911 Encyclopædia Britannica/" prefix) starts with the entity
//      name — disambiguator suffixes like "(general)" / "(Carthaginian)"
//      are common and that's exactly the entry we want.
//
// Coverage caveats: the 1911 Britannica reflects what British scholars
// could (or chose to) cover in 1911. Hit rate is good for classical
// antiquity, European medieval/early-modern, and 19th-century European
// figures. Hit rate is poor for non-European subjects pre-1800 and for
// 20th-century figures. We treat null returns as "use Wikipedia only,"
// not as failure.

const UA =
  process.env.WIKIMEDIA_USER_AGENT ??
  "Alexandria/0.1 (local development; contact: andrestran@icloud.com)";

const BRIT_PREFIX = "1911 Encyclopædia Britannica/";

export interface BritannicaArticle {
  title: string;
  url: string;
  text: string;
  license: "Public domain";
}

export type EntityHintType =
  | "person"
  | "place"
  | "event"
  | "organization"
  | "work"
  | "concept";

// Parenthetical disambiguators that mark a Britannica entry as a US/UK
// place — dock the score hard when the calling entity is a person.
const PLACE_LIKE_SUFFIXES = [
  "Missouri", "Ohio", "Iowa", "Illinois", "Indiana", "Kansas",
  "Michigan", "Minnesota", "Pennsylvania", "Virginia", "New York",
  "Texas", "California", "city", "town", "village", "state", "county",
];

// Suffixes that mark a Britannica entry as biographical — boost when
// the calling entity is a person.
const BIO_LIKE_SUFFIXES = [
  "general", "statesman", "emperor", "king", "queen", "saint",
  "philosopher", "scientist", "author", "poet", "painter", "composer",
];

interface SearchResponse {
  query?: {
    search?: Array<{ title: string; pageid: number }>;
  };
}

/**
 * Search Wikisource for likely 1911-Britannica matches for `name`.
 * Returns the candidate page titles (with the "1911 Encyclopædia
 * Britannica/" prefix). For multi-token person entities we run a
 * second query with the surname-comma-firstname form to catch
 * Britannica's biographical convention ("Darwin, Charles Robert").
 */
async function searchCandidates(
  name: string,
  hint?: EntityHintType,
): Promise<string[]> {
  const queries: string[] = [`"1911 Encyclopædia Britannica/${name}"`];
  if (hint === "person") {
    const tokens = name.trim().split(/\s+/);
    if (tokens.length >= 2) {
      const surname = tokens[tokens.length - 1];
      const given = tokens.slice(0, -1).join(" ");
      queries.push(`"1911 Encyclopædia Britannica/${surname}, ${given}"`);
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of queries) {
    const url =
      "https://en.wikisource.org/w/api.php" +
      `?action=query&format=json&list=search&srnamespace=0&srlimit=10` +
      `&srsearch=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) continue;
    const j = (await r.json()) as SearchResponse;
    for (const h of j.query?.search ?? []) {
      if (!h.title.startsWith(BRIT_PREFIX)) continue;
      if (seen.has(h.title)) continue;
      seen.add(h.title);
      out.push(h.title);
    }
  }
  return out;
}

/**
 * Score a Britannica-prefixed title against an entity name + optional
 * entity type. Higher is a better match. Used to pick among search
 * candidates when the verbatim title 404s.
 *
 * Type bias: for person entities, boost biographical-suffix matches and
 * dock US/UK place-name suffixes. (Without this, "Hannibal (Missouri)"
 * — the Mississippi River city — ties with "Hannibal (general)" — the
 * Carthaginian — at the starts-with stage and wins on alphabetical
 * fallback.)
 */
function scoreTitle(
  title: string,
  entityName: string,
  hint?: EntityHintType,
): number {
  const body = title.slice(BRIT_PREFIX.length);
  const lowerBody = body.toLowerCase();
  const lowerName = entityName.toLowerCase();

  // Look at the parenthetical suffix, if any, for the type-bias step.
  const parenMatch = body.match(/\(([^)]+)\)\s*$/);
  const suffix = parenMatch?.[1]?.toLowerCase() ?? "";

  let typeBias = 0;
  if (hint === "person") {
    if (suffix && PLACE_LIKE_SUFFIXES.some((p) => suffix.includes(p.toLowerCase()))) {
      typeBias -= 60;
    }
    if (suffix && BIO_LIKE_SUFFIXES.some((b) => suffix.includes(b))) {
      typeBias += 25;
    }
  } else if (hint === "place") {
    if (suffix && PLACE_LIKE_SUFFIXES.some((p) => suffix.includes(p.toLowerCase()))) {
      typeBias += 10;
    }
    if (suffix && BIO_LIKE_SUFFIXES.some((b) => suffix.includes(b))) {
      typeBias -= 60;
    }
  }

  // Exact match wins outright.
  if (lowerBody === lowerName) return 100 + typeBias;
  // Starts with name + a disambiguator.
  if (lowerBody.startsWith(lowerName + " (")) return 90 + typeBias;
  // Permissive prefix match (catches trailing punctuation).
  if (lowerBody.startsWith(lowerName)) return 70 + typeBias;

  // Britannica biographical convention: surname-comma-given.
  // For "Charles Darwin" we want to recognise "Darwin, Charles Robert".
  // Split the entity name into tokens; if title starts with the last
  // token + ", " + first-token, it's a strong biographical match.
  const tokens = entityName.trim().split(/\s+/);
  if (tokens.length >= 2) {
    const surname = tokens[tokens.length - 1]!.toLowerCase();
    const firstGiven = tokens[0]!.toLowerCase();
    if (
      lowerBody.startsWith(surname + ", ") &&
      lowerBody.slice(surname.length + 2).startsWith(firstGiven)
    ) {
      return 80 + (hint === "person" ? 15 : 0);
    }
  }

  // Comma-inverted form where the whole entity name appears after
  // the comma — different convention, weaker signal.
  if (lowerBody.includes(", " + lowerName)) return 45;
  // Last-resort substring match.
  if (lowerBody.includes(lowerName)) return 20;
  return 0;
}

/**
 * Fetch HTML for a page and return cleaned plaintext starting at the
 * article body. Returns null if the title doesn't exist.
 */
async function fetchPageText(title: string): Promise<string | null> {
  const url =
    "https://en.wikisource.org/w/rest.php/v1/page/" +
    encodeURIComponent(title) +
    "/html";
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
  });
  if (!r.ok) return null;
  let html = await r.text();
  // Bail if the response is suspiciously small (Wikisource sometimes
  // returns a 200 with a short redirect notice).
  if (html.length < 500) return null;

  // Strip style + script blocks entirely.
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");

  // Keep only what's inside <body>...</body> if present.
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (m) html = m[1] ?? html;

  // Strip remaining tags + collapse whitespace.
  const stripped = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, " ")
    .trim();

  // The Wikisource page has a long navigation header before the article
  // proper. The actual article body starts at the entry name in caps
  // ("HANNIBAL", "CLEOPATRA", …). Try to find that and start there.
  const trail = title.slice(BRIT_PREFIX.length).split(" ")[0]!;
  const upperWord = trail.toUpperCase().replace(/[^A-Z]/g, "");
  if (upperWord.length >= 3) {
    const re = new RegExp(`\\b${upperWord}\\b`);
    const match = stripped.match(re);
    if (match && match.index != null && match.index > 80) {
      return stripped.slice(match.index);
    }
  }
  return stripped;
}

/**
 * Look up a 1911-Britannica article for the entity. Returns null if
 * Wikisource has no usable match.
 */
export async function fetchBritannica1911(
  entityName: string,
  hint?: EntityHintType,
): Promise<BritannicaArticle | null> {
  // 1. Direct title attempt — only if there's no risk of mis-disambiguation.
  // For person entities we skip this short-circuit because the direct match
  // can hit a same-name place ("Hannibal" → city in Missouri). Going through
  // the scorer in step 2 disambiguates correctly.
  if (hint !== "person") {
    const direct = `${BRIT_PREFIX}${entityName}`;
    const text = await fetchPageText(direct);
    if (text && text.length > 600) {
      return {
        title: direct,
        url: `https://en.wikisource.org/wiki/${encodeURIComponent(direct)}`,
        text,
        license: "Public domain",
      };
    }
  }

  // 2. Search for candidates, then score with type-aware bias.
  const candidates = await searchCandidates(entityName, hint);
  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((c) => ({ title: c, score: scoreTitle(c, entityName, hint) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return null;

  for (const c of ranked.slice(0, 3)) {
    const text = await fetchPageText(c.title);
    if (text && text.length > 600) {
      return {
        title: c.title,
        url: `https://en.wikisource.org/wiki/${encodeURIComponent(c.title)}`,
        text,
        license: "Public domain",
      };
    }
  }
  return null;
}
