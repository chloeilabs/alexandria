// Resolve an LLM-claimed citation against open bibliographic databases
// (CrossRef primary, OpenAlex fallback). The citation TEXT is model-claimed;
// resolution checks whether it corresponds to a real work.
//
// Matching is deliberately strict to avoid the PoC's false positives (e.g.
// "The Rosetta Stone" matching a random journal article that merely shares a
// title word):
//   verified  — strong title overlap AND the claimed author corroborates
//   ambiguous — strong title overlap but no author to corroborate / mismatch
//   not_found — no sufficient match
//
// No API key required: CrossRef's polite pool keys on a mailto; OpenAlex
// accepts a mailto too.

const MAILTO = "andrestran@icloud.com";
const UA = `Alexandria (mailto:${MAILTO})`;
const TITLE_STRONG = 0.6;
const TITLE_WEAK = 0.45;

export type ResolutionStatus = "verified" | "ambiguous" | "not_found";

export interface CitationResolution {
  status: ResolutionStatus;
  title: string | null;
  doi: string | null;
  url: string | null;
  confidence: number | null;
  via: "crossref" | "openalex" | null;
}

const NOT_FOUND: CitationResolution = {
  status: "not_found",
  title: null,
  doi: null,
  url: null,
  confidence: null,
  via: null,
};

function sig(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

/** Token overlap as a fraction of the smaller title's significant words. */
function titleOverlap(a: string, b: string): number {
  const ta = sig(a);
  const tb = sig(b);
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter((x) => tb.has(x)).length;
  return inter / Math.min(ta.size, tb.size);
}

/** True if any result-author surname appears as a word in the claimed author. */
function authorCorroborates(
  claimedAuthor: string | null,
  resultFamilies: string[],
): boolean {
  if (!claimedAuthor || resultFamilies.length === 0) return false;
  const claimed = claimedAuthor.toLowerCase();
  return resultFamilies.some(
    (f) => f.length > 2 && claimed.includes(f.toLowerCase()),
  );
}

function classify(
  titleScore: number,
  hasClaimedAuthor: boolean,
  authorMatch: boolean,
): ResolutionStatus {
  if (titleScore >= TITLE_STRONG && hasClaimedAuthor && authorMatch) {
    return "verified";
  }
  if (titleScore >= TITLE_WEAK) return "ambiguous";
  return "not_found";
}

async function tryCrossref(
  source: string,
  author: string | null,
): Promise<CitationResolution | null> {
  const q = encodeURIComponent(`${source} ${author ?? ""}`.trim());
  const url = `https://api.crossref.org/works?query.bibliographic=${q}&rows=3&mailto=${MAILTO}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    message?: {
      items?: {
        title?: string[];
        author?: { family?: string }[];
        DOI?: string;
        URL?: string;
      }[];
    };
  };

  let best: CitationResolution | null = null;
  let bestScore = 0;
  for (const it of data.message?.items ?? []) {
    const t = it.title?.[0];
    if (!t) continue;
    const score = titleOverlap(source, t);
    if (score <= bestScore) continue;
    const families = (it.author ?? [])
      .map((a) => a.family ?? "")
      .filter(Boolean);
    const authorMatch = authorCorroborates(author, families);
    const status = classify(score, !!author, authorMatch);
    if (status === "not_found") continue;
    bestScore = score;
    best = {
      status,
      title: t,
      doi: it.DOI ?? null,
      url: it.DOI ? `https://doi.org/${it.DOI}` : (it.URL ?? null),
      confidence: Math.min(1, score * (authorMatch ? 1 : 0.7)),
      via: "crossref",
    };
  }
  return best;
}

async function tryOpenAlex(
  source: string,
  author: string | null,
): Promise<CitationResolution | null> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(source)}&per_page=3&mailto=${MAILTO}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results?: {
      title?: string | null;
      doi?: string | null;
      id?: string;
      authorships?: { author?: { display_name?: string } }[];
    }[];
  };

  let best: CitationResolution | null = null;
  let bestScore = 0;
  for (const it of data.results ?? []) {
    if (!it.title) continue;
    const score = titleOverlap(source, it.title);
    if (score <= bestScore) continue;
    const families = (it.authorships ?? [])
      .map((a) => (a.author?.display_name ?? "").split(/\s+/).pop() ?? "")
      .filter(Boolean);
    const authorMatch = authorCorroborates(author, families);
    const status = classify(score, !!author, authorMatch);
    if (status === "not_found") continue;
    bestScore = score;
    best = {
      status,
      title: it.title,
      doi: it.doi ? it.doi.replace(/^https?:\/\/doi\.org\//, "") : null,
      url: it.doi ?? it.id ?? null,
      confidence: Math.min(1, score * (authorMatch ? 1 : 0.7)),
      via: "openalex",
    };
  }
  return best;
}

export async function resolveCitation(c: {
  source: string;
  author: string | null;
}): Promise<CitationResolution> {
  try {
    const cr = await tryCrossref(c.source, c.author);
    // Accept CrossRef only if it reached "verified"; otherwise let OpenAlex
    // (broader coverage of books/non-English) get a shot at a stronger match.
    if (cr?.status === "verified") return cr;
    const oa = await tryOpenAlex(c.source, c.author);
    // Prefer whichever is stronger; verified > ambiguous.
    const candidates = [cr, oa].filter(Boolean) as CitationResolution[];
    if (candidates.length === 0) return NOT_FOUND;
    candidates.sort(
      (a, b) =>
        (b.status === "verified" ? 1 : 0) - (a.status === "verified" ? 1 : 0) ||
        (b.confidence ?? 0) - (a.confidence ?? 0),
    );
    return candidates[0]!;
  } catch {
    return NOT_FOUND;
  }
}
