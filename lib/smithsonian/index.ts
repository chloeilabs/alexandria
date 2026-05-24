// Smithsonian Open Access API client. Free, but requires an api.data.gov
// API key (sign up at https://api.data.gov/signup/, takes 30 seconds).
// 5M+ digital items across 21 museums + 9 research centers; especially
// strong on Native American material, natural history, and folklife
// holdings — meaningful coverage gaps Wikimedia Commons doesn't fill.
//
// When SMITHSONIAN_API_KEY is unset (the default at time of shipping
// this client) the search functions return an empty array silently.
// This lets fetch-museum-media.ts call the client unconditionally
// while we wait for a key — same pattern the rest of the codebase uses
// for absent secrets (see lib/ai/index.ts AI_GATEWAY_API_KEY warning).
//
// Base: https://api.si.edu/openaccess/api/v1.0
// Docs: https://edan.si.edu/openaccess/apidocs/

const UA =
  process.env.WIKIMEDIA_USER_AGENT ??
  "Alexandria/0.1 (local development; contact: andrestran@icloud.com)";

const API_KEY = process.env.SMITHSONIAN_API_KEY;

const BASE = "https://api.si.edu/openaccess/api/v1.0";

export interface SmithsonianObject {
  /** Smithsonian content ID (varies by unit), used as a URL component. */
  id: string;
  /** Stable Smithsonian record URL for attribution linkout. */
  recordUrl: string;
  /** High-res image URL on ids.si.edu (or unit-specific media host). */
  imageUrl: string;
  /** Object title, e.g. "Mughal-style miniature of a court scene". */
  title: string;
  /** Unit name, e.g. "National Museum of African American History". */
  unit: string | null;
  /** Free-text date, e.g. "1857" or "early 17th century". */
  date: string | null;
  /** Topic / theme tags joined by " · ". */
  topics: string | null;
}

export interface SearchOptions {
  /** Max objects to return (default 3). */
  limit?: number;
}

interface SearchHit {
  id?: string;
  url?: string;
  unitCode?: string;
  type?: string;
  content?: {
    descriptiveNonRepeating?: {
      title?: { content?: string };
      unit_name?: string;
      record_link?: string;
      online_media?: {
        media?: Array<{ type?: string; content?: string; thumbnail?: string }>;
      };
    };
    indexedStructured?: {
      date?: string[];
      topic?: string[];
    };
  };
}

interface SearchResponse {
  status?: number;
  response?: {
    rows?: SearchHit[];
    rowCount?: number;
  };
}

function normalize(hit: SearchHit): SmithsonianObject | null {
  const descr = hit.content?.descriptiveNonRepeating;
  const title = descr?.title?.content?.trim();
  if (!title) return null;

  // Smithsonian online_media is a list of media records; we want the
  // first IMAGE entry. Some hits have no image at all.
  const mediaList = descr?.online_media?.media ?? [];
  const image = mediaList.find(
    (m) => (m.type ?? "").toLowerCase() === "images" && (m.content || m.thumbnail),
  );
  if (!image) return null;
  const imageUrl = image.content ?? image.thumbnail;
  if (!imageUrl) return null;

  const indexed = hit.content?.indexedStructured;
  const date = indexed?.date?.[0] ?? null;
  const topics = indexed?.topic?.slice(0, 4).join(" · ") || null;
  const recordUrl = descr?.record_link ?? hit.url ?? `https://www.si.edu/object/${hit.id}`;

  return {
    id: hit.id ?? imageUrl,
    recordUrl,
    imageUrl,
    title,
    unit: descr?.unit_name ?? null,
    date,
    topics,
  };
}

/**
 * Search Smithsonian Open Access for objects matching `entityName`.
 * Returns up to `limit` records with images. Silently returns [] if
 * SMITHSONIAN_API_KEY is unset.
 */
export async function searchObjects(
  entityName: string,
  opts: SearchOptions = {},
): Promise<SmithsonianObject[]> {
  if (!API_KEY) return [];
  const limit = Math.max(1, opts.limit ?? 3);

  // Restrict to public-image-bearing records. The `online_media_type`
  // filter narrows to objects with images; `online_media_rights` to
  // CC0 / public domain content.
  const q = [
    `"${entityName.replace(/"/g, '')}"`,
    "online_media_type:Images",
    "online_media_rights:CC0",
  ].join(" AND ");

  const params = new URLSearchParams({
    api_key: API_KEY,
    q,
    rows: String(Math.min(20, limit * 3)),
  });
  const url = `${BASE}/search?${params.toString()}`;
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) {
    console.warn(
      `[smithsonian] search returned ${r.status} for "${entityName}"; skipping`,
    );
    return [];
  }
  const j = (await r.json()) as SearchResponse;
  const rows = j.response?.rows ?? [];
  const normalized: SmithsonianObject[] = [];
  for (const row of rows) {
    const n = normalize(row);
    if (n) normalized.push(n);
    if (normalized.length >= limit) break;
  }
  return normalized;
}
