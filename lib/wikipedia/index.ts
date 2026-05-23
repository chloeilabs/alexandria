// Wikipedia REST + Action API client for ad-hoc enrichment.
// Use this for individual-entity fetches in the enrichment pipeline. For
// bulk ingestion of millions of articles, use the streaming XML dump
// parser instead (pipeline/bulk/import-wikipedia-dump.ts).

import "../env";

const REST_BASE = "https://en.wikipedia.org/api/rest_v1";
const ACTION_BASE = "https://en.wikipedia.org/w/api.php";
const UA =
  process.env.WIKIMEDIA_USER_AGENT ??
  "LibraryOfAlexandria/0.1 (https://example.invalid; contact: andrestran@icloud.com)";

const headers = {
  "User-Agent": UA,
  Accept: "application/json",
};

export interface ArticleSummary {
  title: string;
  extract: string;
  description: string;
  url: string;
  wikibaseItem?: string;
  thumbnailUrl?: string;
}

function stripDiacritics(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

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
  };
  return {
    title: j.title,
    extract: j.extract ?? "",
    description: j.description ?? "",
    url: j.content_urls?.desktop?.page ?? "",
    wikibaseItem: j.wikibase_item,
    thumbnailUrl: j.thumbnail?.source,
  };
}

/**
 * Fetch a short summary (lead paragraph). On 404, retries with diacritics
 * stripped — picks up cases like "Sunjata Keïta" → "Sundiata Keita" where
 * Wikidata's English label has diacritics the Wikipedia article doesn't.
 */
export async function fetchSummary(
  title: string,
): Promise<ArticleSummary | null> {
  const first = await fetchSummaryOnce(title);
  if (first) return first;
  const stripped = stripDiacritics(title);
  if (stripped !== title) return fetchSummaryOnce(stripped);
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
 * title if the first lookup misses — see fetchSummary for rationale.
 */
export async function fetchPlaintext(
  title: string,
): Promise<ArticlePlaintext | null> {
  const first = await fetchPlaintextOnce(title);
  if (first) return first;
  const stripped = stripDiacritics(title);
  if (stripped !== title) return fetchPlaintextOnce(stripped);
  return null;
}

/**
 * Fetch just the lead section of an article (the part before the first
 * section heading). Faster + cheaper than the full extract, sufficient
 * for Tier 1 summary generation.
 */
export async function fetchLeadSection(title: string): Promise<string | null> {
  const article = await fetchPlaintext(title);
  if (!article) return null;
  // The plain-text extract from the action API has section breaks marked
  // by double-newlines + capitalized heading-like lines. Cheap heuristic:
  // take everything before the first newline-newline-capitalized-line.
  const m = article.extract.split(/\n\n(?=[A-Z][A-Za-z ]+\n)/, 1);
  return m[0] ?? article.extract;
}
