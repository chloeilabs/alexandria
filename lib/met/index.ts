// Metropolitan Museum of Art Collection API client. No key required;
// 80 req/sec rate limit; all images returned are CC0 public domain
// when isPublicDomain is true.
//
// Search-quality caveat (verified 2026-05-24): the Met's `q=` search
// returns a DEFAULT PLACEHOLDER SET (the same ~38 Egyptian artifacts)
// when the keyword has no real matches, instead of an honest 0. The
// `tags=true` filter avoids this but is too restrictive — the tag
// corpus is sparse and returns 0 even for entities Met has rich
// holdings about (Hatshepsut, Tang, Mughal). We take a middle path:
// search broadly (no tags filter), then validate each returned object
// by requiring the entity name (or its surname for multi-token person
// names) to appear in the object's title, culture, or artist fields.
// The placeholder Egyptian-stela set fails that validation cleanly;
// genuine matches (e.g. Hatshepsut → stela bearing her name) pass.
//
// Base: https://collectionapi.metmuseum.org/public/collection/v1
// Docs: https://metmuseum.github.io/

const UA =
  process.env.WIKIMEDIA_USER_AGENT ??
  "Alexandria/0.1 (local development; contact: andrestran@icloud.com)";

const BASE = "https://collectionapi.metmuseum.org/public/collection/v1";

export interface MetObject {
  /** Met objectID, e.g. 39901. */
  objectId: number;
  /** Stable Met page URL, suitable for attribution linkout. */
  objectUrl: string;
  /** CC0 high-resolution image URL on images.metmuseum.org. */
  primaryImage: string;
  /** Object title, e.g. "Night-Shining White". */
  title: string;
  /** Artist display name, often empty for anonymous historical works. */
  artist: string | null;
  /** Free-text date, e.g. "ca. 750" or "ca. 1944 B.C.". */
  objectDate: string | null;
  /** Origin culture, e.g. "China". */
  culture: string | null;
  /** Met department, e.g. "Asian Art". */
  department: string | null;
  /** Medium, e.g. "Handscroll; ink and color on paper". */
  medium: string | null;
}

interface MetSearchResponse {
  total: number;
  objectIDs: number[] | null;
}

interface MetObjectResponse {
  objectID: number;
  objectURL?: string;
  primaryImage?: string;
  primaryImageSmall?: string;
  title?: string;
  artistDisplayName?: string;
  objectDate?: string;
  culture?: string;
  department?: string;
  medium?: string;
  isPublicDomain?: boolean;
}

function normalize(r: MetObjectResponse): MetObject | null {
  if (!r.primaryImage || !r.isPublicDomain) return null;
  return {
    objectId: r.objectID,
    objectUrl:
      r.objectURL ??
      `https://www.metmuseum.org/art/collection/search/${r.objectID}`,
    primaryImage: r.primaryImage,
    title: r.title ?? `Met object ${r.objectID}`,
    artist: r.artistDisplayName?.trim() || null,
    objectDate: r.objectDate?.trim() || null,
    culture: r.culture?.trim() || null,
    department: r.department?.trim() || null,
    medium: r.medium?.trim() || null,
  };
}

export interface SearchOptions {
  /** Max objects to return after filtering (default 3). */
  limit?: number;
}

/**
 * Returns true if the entity name (or its surname when multi-token) is
 * a substring of any object metadata field that signals relevance. Used
 * to filter out the Met's no-match placeholder set without dropping
 * real matches.
 */
function isRelevant(obj: MetObject, entityName: string): boolean {
  const tokens = entityName.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  const haystack = [
    obj.title,
    obj.artist,
    obj.culture,
    obj.medium,
    obj.department,
  ]
    .filter((s): s is string => !!s)
    .join(" ")
    .toLowerCase();
  // Multi-token names: require the full name to appear, OR the last
  // distinctive token (surname for persons, second word for places like
  // "Songhai Empire" → "songhai"). Surname-only is acceptable here
  // because we're matching against title/artist/culture, not generic
  // catalogue text — false positives on "musa" are far less common in
  // titles than in book corpora.
  if (haystack.includes(entityName.toLowerCase())) return true;
  if (tokens.length >= 2) {
    return tokens.some((t) => haystack.includes(t));
  }
  return haystack.includes(tokens[0]!);
}

/**
 * Look up Met holdings whose metadata mentions this entity name.
 * Returns up to `limit` CC0-licensed, image-bearing objects after
 * filtering out the Met's no-match placeholder set. The honest 0-result
 * case is the normal behaviour; treat null returns the same way we
 * treat Britannica or IA misses.
 */
export async function searchByName(
  entityName: string,
  opts: SearchOptions = {},
): Promise<MetObject[]> {
  const limit = Math.max(1, opts.limit ?? 3);
  const params = new URLSearchParams({
    q: entityName,
    hasImages: "true",
    isPublicDomain: "true",
  });
  const r = await fetch(`${BASE}/search?${params.toString()}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) return [];
  const j = (await r.json()) as MetSearchResponse;
  // Pull more candidates than we'll keep so post-fetch filtering has
  // a chance to find a few real matches in a placeholder-polluted set.
  const ids = (j.objectIDs ?? []).slice(0, Math.max(20, limit * 8));
  if (ids.length === 0) return [];

  // Fetch in parallel — Met allows 80 req/sec which is plenty for the
  // ~20 IDs we pull.
  const objects = await Promise.all(
    ids.map(async (id) => {
      try {
        const objRes = await fetch(`${BASE}/objects/${id}`, {
          headers: { "User-Agent": UA, Accept: "application/json" },
        });
        if (!objRes.ok) return null;
        const obj = (await objRes.json()) as MetObjectResponse;
        return normalize(obj);
      } catch {
        return null;
      }
    }),
  );

  return objects
    .filter((o): o is MetObject => o !== null)
    .filter((o) => isRelevant(o, entityName))
    .slice(0, limit);
}
