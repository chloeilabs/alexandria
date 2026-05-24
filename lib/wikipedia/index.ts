// Wikipedia REST + Action API client for ad-hoc enrichment.
// Use this for individual-entity fetches in the enrichment pipeline. For
// bulk ingestion of millions of articles, use the streaming XML dump
// parser instead (pipeline/bulk/import-wikipedia-dump.ts).

import "../env";

const REST_BASE = "https://en.wikipedia.org/api/rest_v1";
const ACTION_BASE = "https://en.wikipedia.org/w/api.php";
const WIKIDATA_BASE = "https://www.wikidata.org/wiki/Special:EntityData";
const UA =
  process.env.WIKIMEDIA_USER_AGENT ??
  "Alexandria/0.1 (https://example.invalid; contact: andrestran@icloud.com)";

const headers = {
  "User-Agent": UA,
  Accept: "application/json",
};

// Per-session cache so repair-style scripts don't hammer Wikidata's
// EntityData endpoint twice when they fall through both fetchSummary
// and fetchPlaintext for the same QID. Null = "we tried and there's
// no enwiki sitelink", "" sentinel never appears.
const sitelinkCache = new Map<string, string | null>();

/**
 * Resolve a Wikidata QID to its English Wikipedia article title via
 * the Special:EntityData JSON endpoint. Returns null when the entity
 * has no enwiki sitelink (some Wikidata items only have non-English
 * articles, or none at all).
 *
 * Exported for the repair-titles script; the fetch* helpers in this
 * module use it internally as a last-resort fallback.
 */
export async function resolveWikipediaTitle(
  qid: string,
): Promise<string | null> {
  if (sitelinkCache.has(qid)) return sitelinkCache.get(qid) ?? null;
  const res = await fetch(`${WIKIDATA_BASE}/${qid}.json`, { headers });
  if (!res.ok) {
    sitelinkCache.set(qid, null);
    return null;
  }
  const j = (await res.json()) as {
    entities?: Record<string, {
      sitelinks?: { enwiki?: { title?: string } };
    }>;
  };
  const title = j.entities?.[qid]?.sitelinks?.enwiki?.title ?? null;
  sitelinkCache.set(qid, title);
  return title;
}

/** Options accepted by every fetch* helper. When `qid` is provided,
 *  the helper will fall back to the Wikidata sitelink title after the
 *  literal + diacritic-stripped lookups both miss. Handles cases the
 *  diacritic strip can't: typo'd labels ("TutanKhamun"), foreign-language
 *  labels picked up from Wikidata fallback ("Olmecas"), and entirely
 *  different article titles ("Nzingha Mbande" → "Nzinga of Ndongo and
 *  Matamba"). */
export interface FetchOpts {
  qid?: string;
}

export interface ArticleSummary {
  title: string;
  extract: string;
  description: string;
  url: string;
  wikibaseItem?: string;
  /** ~320px thumbnail; suitable for cards and previews. */
  thumbnailUrl?: string;
  /** Full-resolution original; suitable for hero rendering. */
  originalUrl?: string;
  /** Width/height of the original. */
  originalWidth?: number;
  originalHeight?: number;
}

import { stripDiacritics } from "../format";

async function fetchSummaryOnce(
  title: string,
): Promise<ArticleSummary | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, "_"));
  const res = await fetch(`${REST_BASE}/page/summary/${encoded}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Wikipedia summary ${res.status} for ${title}`);
  }
  const j = (await res.json()) as {
    title: string;
    extract?: string;
    description?: string;
    content_urls?: { desktop?: { page?: string } };
    wikibase_item?: string;
    thumbnail?: { source?: string };
    originalimage?: { source?: string; width?: number; height?: number };
  };
  return {
    title: j.title,
    extract: j.extract ?? "",
    description: j.description ?? "",
    url: j.content_urls?.desktop?.page ?? "",
    wikibaseItem: j.wikibase_item,
    thumbnailUrl: j.thumbnail?.source,
    originalUrl: j.originalimage?.source,
    originalWidth: j.originalimage?.width,
    originalHeight: j.originalimage?.height,
  };
}

/**
 * Fetch a short summary (lead paragraph). On 404, retries with diacritics
 * stripped ("Sunjata Keïta" → "Sundiata Keita"), then if `opts.qid` is
 * given, falls back to the Wikidata enwiki sitelink ("TutanKhamun" →
 * "Tutankhamun", "Olmecas" → "Olmecs", "Nzingha Mbande" → "Nzinga of
 * Ndongo and Matamba"). The sitelink fallback hits one extra Wikidata
 * call per cache miss; cached per session.
 */
export async function fetchSummary(
  title: string,
  opts: FetchOpts = {},
): Promise<ArticleSummary | null> {
  const first = await fetchSummaryOnce(title);
  if (first) return first;
  const stripped = stripDiacritics(title);
  if (stripped !== title) {
    const second = await fetchSummaryOnce(stripped);
    if (second) return second;
  }
  if (opts.qid) {
    const sitelinkTitle = await resolveWikipediaTitle(opts.qid);
    if (sitelinkTitle && sitelinkTitle !== title && sitelinkTitle !== stripped) {
      return fetchSummaryOnce(sitelinkTitle);
    }
  }
  return null;
}

export interface ArticlePlaintext {
  title: string;
  pageid: number;
  extract: string;
  url: string;
  wikibaseItem?: string;
}

async function fetchPlaintextOnce(
  title: string,
): Promise<ArticlePlaintext | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "extracts|pageprops",
    explaintext: "1",
    redirects: "1",
    titles: title,
  });
  const res = await fetch(`${ACTION_BASE}?${params}`, { headers });
  if (!res.ok) {
    throw new Error(`Wikipedia action query ${res.status} for ${title}`);
  }
  const j = (await res.json()) as {
    query?: { pages?: Record<string, {
      title: string;
      pageid?: number;
      missing?: string;
      extract?: string;
      pageprops?: { wikibase_item?: string };
    }> };
  };
  const pages = j.query?.pages ?? {};
  const first = Object.values(pages)[0];
  if (!first || first.missing !== undefined || !first.pageid) return null;
  const normTitle = first.title.replace(/ /g, "_");
  return {
    title: first.title,
    pageid: first.pageid,
    extract: first.extract ?? "",
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(normTitle)}`,
    wikibaseItem: first.pageprops?.wikibase_item,
  };
}

/**
 * Fetch the full plain-text extract. Falls back to a diacritic-stripped
 * title if the first lookup misses, then to the Wikidata enwiki sitelink
 * when `opts.qid` is provided. See fetchSummary for the canonical
 * explanation of why both fallbacks are needed.
 */
export async function fetchPlaintext(
  title: string,
  opts: FetchOpts = {},
): Promise<ArticlePlaintext | null> {
  const first = await fetchPlaintextOnce(title);
  if (first) return first;
  const stripped = stripDiacritics(title);
  if (stripped !== title) {
    const second = await fetchPlaintextOnce(stripped);
    if (second) return second;
  }
  if (opts.qid) {
    const sitelinkTitle = await resolveWikipediaTitle(opts.qid);
    if (sitelinkTitle && sitelinkTitle !== title && sitelinkTitle !== stripped) {
      return fetchPlaintextOnce(sitelinkTitle);
    }
  }
  return null;
}

/**
 * Fetch just the lead section of an article (the part before the first
 * section heading). Faster + cheaper than the full extract, sufficient
 * for Tier 1 summary generation.
 */
export async function fetchLeadSection(
  title: string,
  opts: FetchOpts = {},
): Promise<string | null> {
  const article = await fetchPlaintext(title, opts);
  if (!article) return null;
  // The plain-text extract from the action API has section breaks marked
  // by double-newlines + capitalized heading-like lines. Cheap heuristic:
  // take everything before the first newline-newline-capitalized-line.
  const m = article.extract.split(/\n\n(?=[A-Z][A-Za-z ]+\n)/, 1);
  return m[0] ?? article.extract;
}
