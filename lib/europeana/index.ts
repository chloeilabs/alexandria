// Europeana Search API client. Free, requires a Europeana API key
// (sign up at https://pro.europeana.eu/page/get-api). 20M+ aggregated
// items from 1,500+ European cultural institutions — strongest source
// for medieval manuscripts, Renaissance prints, and modern European
// photography.
//
// When EUROPEANA_API_KEY is unset (the default at time of shipping
// this client) the search function returns an empty array silently.
// Mirrors the Smithsonian client pattern so fetch-museum-media.ts can
// call all three unconditionally.
//
// Auth uses the X-Api-Key header (the preferred form since 2023;
// the older `wskey` query param is deprecated).
//
// Base: https://api.europeana.eu/record/v2/search.json
// Docs: https://pro.europeana.eu/page/search

const UA =
  process.env.WIKIMEDIA_USER_AGENT ??
  "Alexandria/0.1 (local development; contact: andrestran@icloud.com)";

const API_KEY = process.env.EUROPEANA_API_KEY;

const BASE = "https://api.europeana.eu/record/v2/search.json";

export interface EuropeanaObject {
  /** Europeana record ID, e.g. "/2024903/photography_ProvidedCHO_KU_…". */
  id: string;
  /** Stable Europeana record URL for attribution linkout. */
  recordUrl: string;
  /** Preview image URL (Europeana-served thumbnail, IIIF where available). */
  imageUrl: string;
  /** Object title — Europeana sometimes returns these untranslated. */
  title: string;
  /** Provider institution, e.g. "Bibliothèque nationale de France". */
  dataProvider: string | null;
  /** Country of provider, two-letter ISO code where available. */
  country: string | null;
  /** Year range as a free-text string. */
  year: string | null;
  /** Reusability bucket: open / restricted / permission. */
  rights: string | null;
}

export interface SearchOptions {
  /** Max items to return (default 3). */
  limit?: number;
}

interface SearchItem {
  id?: string;
  guid?: string;
  type?: string;
  title?: string[];
  edmPreview?: string[];
  dataProvider?: string[];
  country?: string[];
  year?: string[];
  rights?: string[];
}

interface SearchResponse {
  success?: boolean;
  totalResults?: number;
  items?: SearchItem[];
}

function normalize(item: SearchItem): EuropeanaObject | null {
  const preview = item.edmPreview?.[0];
  if (!preview) return null;
  const title = item.title?.[0]?.trim();
  if (!title) return null;

  return {
    id: item.id ?? preview,
    recordUrl:
      item.guid ??
      (item.id ? `https://www.europeana.eu/en/item${item.id}` : preview),
    imageUrl: preview,
    title,
    dataProvider: item.dataProvider?.[0]?.trim() ?? null,
    country: item.country?.[0]?.trim() ?? null,
    year: item.year?.[0]?.trim() ?? null,
    rights: item.rights?.[0]?.trim() ?? null,
  };
}

/**
 * Search Europeana for items matching `entityName`. Restricts to
 * `media=true` (item must have a renderable media asset) and
 * `reusability=open` (CC-licensed or public domain only).
 *
 * Silently returns [] if EUROPEANA_API_KEY is unset.
 */
export async function searchItems(
  entityName: string,
  opts: SearchOptions = {},
): Promise<EuropeanaObject[]> {
  if (!API_KEY) return [];
  const limit = Math.max(1, opts.limit ?? 3);

  const params = new URLSearchParams({
    query: entityName,
    rows: String(Math.min(20, limit * 2)),
    media: "true",
    thumbnail: "true",
    reusability: "open",
    profile: "minimal",
  });

  const r = await fetch(`${BASE}?${params.toString()}`, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "X-Api-Key": API_KEY,
    },
  });
  if (!r.ok) {
    console.warn(
      `[europeana] search returned ${r.status} for "${entityName}"; skipping`,
    );
    return [];
  }
  const j = (await r.json()) as SearchResponse;
  const items = j.items ?? [];
  const normalized: EuropeanaObject[] = [];
  for (const item of items) {
    const n = normalize(item);
    if (n) normalized.push(n);
    if (normalized.length >= limit) break;
  }
  return normalized;
}
