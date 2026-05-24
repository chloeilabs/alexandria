// World Historical Gazetteer (WHG) client. The Index API at
// /api/index/?name= is publicly callable without a token — it returns
// LPF-shaped FeatureCollections with multilingual variants, time
// spans, country codes, and point coordinates. The token-required
// Entity / Reconciliation / Suggest APIs are behind WHG_API_TOKEN
// (free signup) and are not exercised by the MVP; the no-token
// Index path already delivers the bias-mitigation value (non-Western
// place name variants flowing into entity_aliases for search).
//
// WHG is bot-filtered — a real User-Agent header is mandatory or
// every call returns 403 "Bot access denied". WIKIMEDIA_USER_AGENT
// from env doubles for this purpose.
//
// Docs: https://docs.whgazetteer.org/content/technical/apis.html
// Base: https://whgazetteer.org

const UA =
  process.env.WIKIMEDIA_USER_AGENT ??
  "Alexandria/0.1 (https://alexandria.chloei.ai; andrestran@icloud.com)";

const API_TOKEN = process.env.WHG_API_TOKEN;

const BASE = "https://whgazetteer.org";

export interface WhgPlace {
  /** WHG internal place_id, the primary cross-reference key. */
  placeId: number;
  /** Index ID, separate from place_id. Useful for /entity/ lookups. */
  indexId: string | null;
  /** Primary title — usually the dominant English name. */
  title: string;
  /** Alternate names (often non-English). The bias-mitigation payload. */
  variants: string[];
  /** "P" = populated place, "A" = administrative, "L" = landmark, etc. */
  fclasses: string[];
  /** Free-text place types (e.g. "Pueblo", "city", "kingdom"). */
  placetypes: string[];
  /** Time span where attested (gte, lte are years). */
  minmax: { gte: number; lte: number } | null;
  /** ISO 3166-1 alpha-2 country codes the place is associated with. */
  ccodes: string[];
  /** Originating WHG dataset. */
  dataset: string | null;
  /** [lon, lat] — Point geometry only (WHG indexes points). */
  coordinates: [number, number] | null;
  /** WHG's relevance score for this query. Higher = better. */
  score: number;
}

export interface SearchOptions {
  /** Max results to keep (default 5). */
  limit?: number;
}

interface WhgFeature {
  type?: string;
  score?: number;
  properties?: {
    title?: string;
    index_id?: string;
    place_id?: number;
    variants?: string[];
    fclasses?: string[];
    placetypes?: string[];
    minmax?: { gte: number; lte: number };
    ccodes?: string[];
    dataset?: string;
  };
  geometry?: {
    type?: string;
    coordinates?: number[];
  };
}

interface WhgIndexResponse {
  type?: string;
  note?: string;
  features?: WhgFeature[];
}

function normalize(f: WhgFeature): WhgPlace | null {
  const p = f.properties;
  if (!p?.title || typeof p.place_id !== "number") return null;
  const coords =
    f.geometry?.type === "Point" &&
    Array.isArray(f.geometry.coordinates) &&
    f.geometry.coordinates.length >= 2
      ? ([f.geometry.coordinates[0]!, f.geometry.coordinates[1]!] as [number, number])
      : null;
  return {
    placeId: p.place_id,
    indexId: p.index_id ?? null,
    title: p.title,
    variants: Array.isArray(p.variants) ? p.variants.filter(Boolean) : [],
    fclasses: Array.isArray(p.fclasses) ? p.fclasses : [],
    placetypes: Array.isArray(p.placetypes) ? p.placetypes : [],
    minmax: p.minmax ?? null,
    ccodes: Array.isArray(p.ccodes) ? p.ccodes : [],
    dataset: p.dataset ?? null,
    coordinates: coords,
    score: typeof f.score === "number" ? f.score : 0,
  };
}

/**
 * Public index-API search for places matching `name`. No token needed.
 * Returns deduplicated places sorted by relevance score descending.
 */
export async function searchByName(
  name: string,
  opts: SearchOptions = {},
): Promise<WhgPlace[]> {
  const limit = Math.max(1, opts.limit ?? 5);
  const params = new URLSearchParams({ name });
  const r = await fetch(`${BASE}/api/index/?${params.toString()}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) {
    console.warn(
      `[whg] index search returned ${r.status} for "${name}"; skipping`,
    );
    return [];
  }
  const j = (await r.json()) as WhgIndexResponse;
  const features = j.features ?? [];

  const normalized: WhgPlace[] = [];
  const seen = new Set<number>();
  for (const f of features) {
    const n = normalize(f);
    if (!n || seen.has(n.placeId)) continue;
    seen.add(n.placeId);
    normalized.push(n);
  }
  normalized.sort((a, b) => b.score - a.score);
  return normalized.slice(0, limit);
}

export interface WhgEntityDetail extends WhgPlace {
  /** Full LPF feature, in case downstream needs anything beyond the
   *  normalised projection (timespans array, when_chunks, geom collection). */
  raw: unknown;
}

/**
 * Token-required entity-detail lookup. Fetches the full LPF feature
 * for a WHG place_id. Returns null when WHG_API_TOKEN is unset; the
 * MVP doesn't depend on this path but it's wired for future use.
 *
 * Docs: https://whgazetteer.org/entity/place:<id>/api?token=<token>
 */
export async function fetchEntity(placeId: number): Promise<WhgEntityDetail | null> {
  if (!API_TOKEN) return null;
  const url = `${BASE}/entity/place:${placeId}/api?token=${encodeURIComponent(API_TOKEN)}`;
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) {
    console.warn(`[whg] entity ${placeId} returned ${r.status}; skipping`);
    return null;
  }
  const f = (await r.json()) as WhgFeature;
  const n = normalize(f);
  if (!n) return null;
  return { ...n, raw: f };
}
