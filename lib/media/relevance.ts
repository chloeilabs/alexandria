// Shared name-relevance validator for museum-API responses.
//
// The Met/Smithsonian/Europeana keyword searches all suffer from the
// same disambiguation problem: short tokens like "Musa" (the entity)
// match the *Musa* genus (bananas), "Akbar" matches collector names on
// botanical specimens, "Mali" matches dozens of unrelated 19th-century
// objects whose catalog metadata happens to contain the substring.
//
// The validator answers the same question for all three: does the
// entity name (or any of its distinctive tokens, for multi-word names)
// actually appear as a word boundary in the object's metadata? If
// none of them do, the object isn't really about the entity — skip.

const WORD_BOUNDARY_CACHE = new Map<string, RegExp>();

function wordBoundary(token: string): RegExp {
  const cached = WORD_BOUNDARY_CACHE.get(token);
  if (cached) return cached;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  WORD_BOUNDARY_CACHE.set(token, re);
  return re;
}

/**
 * Returns true if the entity name (or, for multi-token names, any of
 * its tokens ≥ 3 chars) appears as a word-boundary match in `haystack`.
 * Pass a concatenation of the object's metadata fields as `haystack`.
 */
export function nameMatchesHaystack(
  entityName: string,
  haystack: string,
): boolean {
  if (!entityName || !haystack) return false;
  const haystackLower = haystack.toLowerCase();
  const nameLower = entityName.toLowerCase();
  // Full-name word-boundary match wins immediately.
  if (wordBoundary(nameLower).test(haystackLower)) return true;
  // Multi-token: any 3+ char token must appear as a word boundary.
  const tokens = nameLower.split(/\s+/).filter((t) => t.length >= 3);
  if (tokens.length >= 2) {
    return tokens.some((t) => wordBoundary(t).test(haystackLower));
  }
  // Single-token names already failed the full-name check above.
  return false;
}

// ---------------------------------------------------------------------------
// Entity-type-aware filters
// ---------------------------------------------------------------------------

/**
 * Catches Linnaean binomial / trinomial / cultivar titles used by natural-
 * history collections — "Prunus 'Saladin'", "Hibiscus lunariifolius Willd.",
 * "Acomys cahirinus cahirinus", "Leucaena leucocephala (Lam.) de Wit".
 * These slip through name-match validation because the entity name appears
 * literally in the cultivar/species epithet, but they're never about the
 * Alexandria entity (a person, place, or event).
 *
 * Returns true when the title's leading tokens fit the genus + lowercase-
 * species or genus + 'cultivar-name' pattern.
 */

// Common English function words that would otherwise be misread as
// species epithets in titles like "Gate of the Tomb of the Emperor Akbar"
// (where "Gate" + "of" wrongly matches Genus + species).
const ENGLISH_WORDS_NEVER_SPECIES = new Set([
  "the", "and", "for", "with", "from", "into", "onto", "upon",
  "over", "under", "this", "that", "these", "those",
  // 2-char prepositions handled by min-length below; listed for clarity:
  "of", "in", "to", "on", "at", "by", "or", "as", "an", "is", "be",
]);

export function looksLikeTaxonomicSpecimen(title: string): boolean {
  if (!title) return false;
  const t = title.trim();
  // Pattern B first — "Genus 'cultivar'" is unambiguous taxonomic
  // notation (no English title looks like this).
  if (/^[A-Z][a-z]{2,}\s+['"][A-Z]/.test(t)) return true;
  // Pattern A: "Genus species …" — capitalized 4+ char genus followed
  // by a lowercase 3+ char species epithet. Stop-list filters out
  // English titles ("Gate of …", "House for the …") whose first two
  // tokens superficially match.
  const m = t.match(/^([A-Z][a-z]{3,})\s+([a-z]{3,})(?:\s|\b)/);
  if (m && !ENGLISH_WORDS_NEVER_SPECIES.has(m[2]!)) {
    // Require an ADDITIONAL taxonomic signal — a third lowercase token
    // (subspecies), a Latin authority suffix ("Willd.", "L.", "(Lam.)
    // de Wit"), or bullet-separated catalog metadata. All real binomial
    // titles in museum collections carry one of these. Without one,
    // titles like "Akbar handing the imperial crown" would false-
    // positive simply because they start with [CapWord lowerword].
    const tail = t.slice(m[0].length).trim();
    const trinomialMatch = tail.match(/^([a-z]{3,})\b/);
    // Latin-ish suffix check — real subspecies tokens end in -us, -a,
    // -um, -is, -ae, -i, etc. English nouns like "statue", "handing",
    // "imperial" rarely match. Tighter than a stoplist (we'd need to
    // enumerate every common English noun otherwise).
    const trinomialLooksLatin =
      trinomialMatch !== null &&
      /(?:us|is|es|um|ae|os|as|ica|ata|atum|ensis|ifera|icus|aceae)$/.test(
        trinomialMatch[1]!,
      );
    const looksScientific =
      trinomialLooksLatin ||
      /\b(?:Willd|Trautv|Lam|Lin|Linn|Boiss|Mill|DC)\.?\b/.test(tail) ||
      /^\([A-Z]/.test(tail) || // "(Lam.) de Wit"
      /^L\.\s/.test(tail) || // Linnaeus bare "L."
      /^[·•]/.test(tail); // bullet-separated metadata
    if (looksScientific) return true;
  }
  return false;
}

/**
 * Provider / unit / data-source strings that overwhelmingly index
 * natural-science specimens. Any hit here means the candidate is almost
 * certainly a botanical / zoological / mineralogical record, not a
 * cultural-heritage object about the entity.
 */
const NATURAL_SCIENCE_PROVIDER_PATTERN =
  /\b(naturalis|biodiversity|herbari|botanic(?:al)?\s+garden|natural\s+history\s+museum|smithsonian\s+national\s+museum\s+of\s+natural\s+history|nmnh|zoological)\b/i;

export function isNaturalScienceSource(
  ...providers: Array<string | null | undefined>
): boolean {
  for (const p of providers) {
    if (!p) continue;
    if (NATURAL_SCIENCE_PROVIDER_PATTERN.test(p)) return true;
  }
  return false;
}

/**
 * Best-effort year extraction from free-text date strings museums use.
 * Handles: "1850s", "1820-1830", "circa 1820", "ca. 1944 B.C.",
 * "247 BCE", "early 17th century" (returns null — no clean digits).
 * Returns a single representative year (the first parseable one) or null.
 * Negative years represent BCE.
 */
export function extractYearFromDateText(text: string): number | null {
  if (!text) return null;
  const trimmed = text.trim();
  // BCE first — "ca. 1944 B.C.", "247 BCE", "B.C.E. 1280"
  const bce = trimmed.match(/(\d{1,4})\s*B\.?C\.?(?:E\.?)?/i);
  if (bce) return -parseInt(bce[1]!, 10);
  const bceLead = trimmed.match(/B\.?C\.?(?:E\.?)?\s*(\d{1,4})/i);
  if (bceLead) return -parseInt(bceLead[1]!, 10);
  // CE / no-suffix — first 4-digit year wins.
  const ce = trimmed.match(/\b(\d{4})\b/);
  if (ce) return parseInt(ce[1]!, 10);
  // Decade fallback — "1850s" → 1850.
  const decade = trimmed.match(/\b(\d{3})0s\b/);
  if (decade) return parseInt(decade[1]! + "0", 10);
  return null;
}

/**
 * Returns true when the candidate's date falls within a generous window
 * around the entity's lifespan. For an entity with start=−247, end=−183
 * (Hannibal Barca), an 1850s Hannibal Hamlin candidate fails. For an
 * entity without dates, or a candidate without parseable dates, the
 * check is skipped (returns true — can't filter without signal).
 *
 * Buffer defaults to 200 years on either side. Asymmetric historical
 * coverage (later art depicting earlier figures is common — 19th c.
 * portraits of Hannibal Barca exist) means we keep the late-side buffer
 * wide; the use case is rejecting unambiguously wrong-period matches
 * like 1850s American politicians, not period art.
 */
export function dateWindowAccepts(
  entityStart: number | null | undefined,
  entityEnd: number | null | undefined,
  candidateDateText: string | null | undefined,
  options: { bufferYears?: number; lateBufferYears?: number } = {},
): boolean {
  if (entityStart == null && entityEnd == null) return true;
  if (!candidateDateText) return true;
  const candidateYear = extractYearFromDateText(candidateDateText);
  if (candidateYear == null) return true;
  const start = entityStart ?? entityEnd ?? 0;
  const end = entityEnd ?? entityStart ?? 0;
  const earlyBuffer = options.bufferYears ?? 200;
  // Allow later depictions liberally — period art of ancient figures
  // shows up centuries / millennia after the fact.
  const lateBuffer = options.lateBufferYears ?? 2500;
  return (
    candidateYear >= start - earlyBuffer &&
    candidateYear <= end + lateBuffer
  );
}
