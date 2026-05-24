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
