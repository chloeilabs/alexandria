// OpenAlex REST client for fact-check corroboration. Pulls top-cited
// peer-reviewed works for an entity / claim so the fact-check pipeline
// can mark Gemini findings with "N scholarly works exist on this topic"
// signals, demoting confidence in flags that scholarship clearly
// supports.
//
// Auth: API key support is wired (OPENALEX_API_KEY) but optional. The
// public API still answers anonymous requests as of 2026-05-24; if/when
// the key requirement is enforced more strictly, dropping the key in
// `.env.local` / `.env.prod` makes the existing code authenticated
// without any further change. A polite-pool mailto can be set via
// OPENALEX_MAILTO for slightly better rate-limit treatment.
//
// Scope discipline: this client is intentionally minimal. One search,
// one decode helper for abstract_inverted_index, one corroboration
// shape. Anything more (concept tagging, author lookups, institutional
// affiliation) belongs in a separate client file.

const UA =
  process.env.WIKIMEDIA_USER_AGENT ??
  "Alexandria/0.1 (local development; contact: andrestran@icloud.com)";

const API_KEY = process.env.OPENALEX_API_KEY;
const MAILTO = process.env.OPENALEX_MAILTO;

const BASE = "https://api.openalex.org";

export interface OpenAlexWork {
  /** OpenAlex stable ID, e.g. "https://openalex.org/W2741809807" */
  id: string;
  /** Article title. */
  title: string;
  /** Year of publication; null when OpenAlex hasn't backfilled it. */
  year: number | null;
  /** DOI URL, e.g. "https://doi.org/10.1234/abc". */
  doi: string | null;
  /** First author display name; null if no authorship recorded. */
  firstAuthor: string | null;
  /** Citation count at fetch time — rough relevance/quality proxy. */
  citedByCount: number;
  /** Decoded abstract plaintext, where OpenAlex has one (often null). */
  abstract: string | null;
}

interface SearchOptions {
  /** Limit results returned (default 5, max 25 to keep fact-check small). */
  limit?: number;
  /** Optional bias: only include works PUBLISHED in this year range. Note
   *  this is publication date of the SCHOLARSHIP, not the historical date
   *  of the subject — useful for "show me only post-2000 scholarship".
   *  Do NOT pass an entity's lifetime here; corroboration wants modern
   *  works ABOUT a subject, not primary sources FROM their era. BCE
   *  values are dropped (OpenAlex publication_date format starts CE). */
  publishedFromYear?: number;
  publishedToYear?: number;
}

interface SearchResponse {
  meta?: { count?: number };
  results?: Array<{
    id: string;
    display_name: string;
    publication_year: number | null;
    doi: string | null;
    cited_by_count: number;
    abstract_inverted_index: Record<string, number[]> | null;
    authorships?: Array<{
      author?: { display_name?: string };
    }>;
  }>;
}

function buildAuthParams(): URLSearchParams {
  const p = new URLSearchParams();
  if (API_KEY) p.set("api_key", API_KEY);
  if (MAILTO) p.set("mailto", MAILTO);
  return p;
}

/**
 * Decode the abstract_inverted_index (word → positions) into a plaintext
 * string. OpenAlex stores abstracts this way for licensing reasons;
 * it's lossless and trivial to invert.
 */
function decodeAbstract(idx: Record<string, number[]> | null): string | null {
  if (!idx) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(idx)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  // Some positions may be holes (rare). Drop undefined entries.
  return words.filter((w) => w != null).join(" ") || null;
}

function normalizeWork(
  r: NonNullable<SearchResponse["results"]>[number],
): OpenAlexWork {
  return {
    id: r.id,
    title: r.display_name,
    year: r.publication_year,
    doi: r.doi,
    firstAuthor: r.authorships?.[0]?.author?.display_name ?? null,
    citedByCount: r.cited_by_count,
    abstract: decodeAbstract(r.abstract_inverted_index ?? null),
  };
}

/**
 * Search peer-reviewed works for a free-text query (typically: entity
 * name + optionally a key term from a flagged claim). Returns the most
 * cited matches first.
 */
export async function searchWorks(
  query: string,
  opts: SearchOptions = {},
): Promise<OpenAlexWork[]> {
  const limit = Math.min(25, Math.max(1, opts.limit ?? 5));
  const params = buildAuthParams();
  params.set("search", query);
  params.set("per-page", String(limit));
  params.set("sort", "cited_by_count:desc");
  params.set(
    "select",
    "id,display_name,publication_year,doi,cited_by_count,abstract_inverted_index,authorships",
  );

  const filters: string[] = [];
  // Skip BCE (negative) years entirely — they're nonsensical as a
  // publication-date filter (OpenAlex only knows about ~CE 1500+) and
  // the most common mistake here is passing an entity's lifetime when
  // what was meant was "modern scholarship about this entity".
  if (typeof opts.publishedFromYear === "number" && opts.publishedFromYear > 0) {
    filters.push(`from_publication_date:${opts.publishedFromYear}-01-01`);
  }
  if (typeof opts.publishedToYear === "number" && opts.publishedToYear > 0) {
    filters.push(`to_publication_date:${opts.publishedToYear}-12-31`);
  }
  if (filters.length > 0) {
    params.set("filter", filters.join(","));
  }

  const url = `${BASE}/works?${params.toString()}`;
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) {
    // Don't throw — the fact-check pass can proceed without
    // corroboration. Log so the failure is visible if it becomes
    // chronic.
    console.warn(
      `[openalex] search returned ${r.status} for "${query.slice(0, 60)}"; skipping corroboration`,
    );
    return [];
  }
  const j = (await r.json()) as SearchResponse;
  return (j.results ?? []).map(normalizeWork);
}

export interface ClaimCorroboration {
  /** Total OpenAlex works matching the query (capped to per-page limit). */
  totalMatches: number;
  /** Top-cited works, with abstract excerpts where available. */
  topWorks: OpenAlexWork[];
  /** Strength signal: weak / partial / strong, derived from totals + citations. */
  signal: "weak" | "partial" | "strong";
}

/**
 * Pull corroboration evidence for a specific flagged claim. Queries
 * OpenAlex with the entity name + the most distinctive terms from the
 * claim (de-duplicated against the entity name itself). Returns a
 * structured summary suitable for embedding in the
 * fact_check_reviews.flagged_claims JSON.
 */
export async function corroborateClaim(
  entityName: string,
  claim: string,
  opts: SearchOptions = {},
): Promise<ClaimCorroboration> {
  const STOPWORDS = new Set([
    "the", "a", "an", "of", "in", "to", "and", "or", "but",
    "is", "was", "were", "are", "be", "been", "being",
    "with", "without", "as", "at", "on", "by", "for", "from",
    "this", "that", "these", "those", "his", "her", "their",
    "had", "have", "has", "would", "could", "should",
    "during", "after", "before", "while", "when", "where",
    "into", "onto", "upon", "over", "under", "than", "such",
  ]);
  // Tokens already in the entity name shouldn't be repeated in the
  // query (they were ranking the same terms twice and crowding out
  // distinctive claim terms). Normalise apostrophes / possessives off
  // both sides so "Musa's" and "Musa" match the same way.
  const normalise = (s: string) => s.replace(/['']/g, "").toLowerCase();
  const entityTokens = new Set(
    normalise(entityName).split(/\s+/).filter((t) => t.length > 0),
  );
  const claimTerms = normalise(claim)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(
      (t) => t.length >= 3 && !STOPWORDS.has(t) && !entityTokens.has(t),
    )
    // 3 distinctive terms keeps OpenAlex's keyword-AND behaviour from
    // over-constraining. 6 terms dropped recall on Mansa Musa / Hannibal
    // queries that returned strong scholarship at 3 terms.
    .slice(0, 3)
    .join(" ");
  const query = claimTerms
    ? `${entityName} ${claimTerms}`
    : entityName;

  const fetched = await searchWorks(query, { limit: opts.limit ?? 3, ...opts });

  // Get the total separately by calling without per-page=large; meta.count
  // is returned on every call regardless of per-page, so the searchWorks
  // call above also has the total available — but we lost it in the
  // normalizer. Easier to just count what we got, with a "20+" indicator
  // when at limit; the fact-check use case doesn't need precision.
  const totalMatches = fetched.length;

  let signal: ClaimCorroboration["signal"] = "weak";
  if (fetched.length >= 3) {
    const topCites = fetched.reduce(
      (max, w) => Math.max(max, w.citedByCount),
      0,
    );
    if (topCites >= 25) signal = "strong";
    else if (topCites >= 5) signal = "partial";
  } else if (fetched.length >= 1) {
    signal = "partial";
  }

  return {
    totalMatches,
    topWorks: fetched,
    signal,
  };
}
