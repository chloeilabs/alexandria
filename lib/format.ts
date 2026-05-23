// Date and text formatting helpers. Centralized so the Tier-1 summary,
// Tier-2 narrative, timeline tooltip, map popup, and search snippet all
// render dates and ranges identically.

const ORDINALS = ["th", "st", "nd", "rd"] as const;

function ordinalSuffix(n: number): string {
  const v = n % 100;
  return ORDINALS[(v - 20) % 10] ?? ORDINALS[v] ?? ORDINALS[0]!;
}

/** "44 BCE", "1492 CE", "12th c. CE", "1320s CE", "2k BCE". */
export function fmtYear(
  year: number | null | undefined,
  precision: string | null | undefined = "year",
): string {
  if (year == null) return "";
  const era = year < 0 ? "BCE" : "CE";
  const y = Math.abs(year);
  switch (precision) {
    case "decade":
      return `${y}s ${era}`;
    case "century": {
      // 1-100 = 1st c., 101-200 = 2nd c., etc. (year 100 belongs to 1st c.,
      // year 900 BCE belongs to 9th c. BCE — not 10th).
      const c = Math.floor((y - 1) / 100) + 1;
      return `${c}${ordinalSuffix(c)} c. ${era}`;
    }
    case "millennium":
      return `${Math.floor(y / 1000)}k ${era}`;
    default:
      return `${y} ${era}`;
  }
}

/** "44 BCE – 14 CE", "1280–1337 CE", or just "1492 CE" if no end. */
export function fmtDateRange(
  start: number | null | undefined,
  startPrecision: string | null | undefined = "year",
  end: number | null | undefined = null,
  endPrecision: string | null | undefined = "year",
): string {
  if (start == null) return "";
  const a = fmtYear(start, startPrecision);
  if (end == null) return a;
  const b = fmtYear(end, endPrecision);
  return `${a} – ${b}`;
}

/** Group a year into a coarse era label for the homepage rotation. */
export function eraFor(year: number | null | undefined): string {
  if (year == null) return "Undated";
  if (year < -1000) return "Ancient";
  if (year < 500) return "Classical";
  if (year < 1500) return "Medieval";
  if (year < 1800) return "Early Modern";
  return "Modern";
}

// Words that stay lowercase in title-cased labels (common Chicago/AP rules).
const LOWER_WORDS = new Set([
  "and",
  "of",
  "the",
  "in",
  "on",
  "to",
  "for",
  "a",
  "an",
  "but",
  "or",
  "nor",
]);

/**
 * Slugified region label → presentation label.
 * "west-african-empires" → "West African Empires"
 * "vedic-and-mauryan" → "Vedic and Mauryan"
 * "delhi-sultanate-and-mughal" → "Delhi Sultanate and Mughal"
 * Always capitalizes the first word regardless of LOWER_WORDS.
 */
export function regionLabel(slug: string | null | undefined): string {
  if (!slug) return "";
  return slug
    .split("-")
    .map((w, i) => {
      if (w.length === 0) return "";
      if (i > 0 && LOWER_WORDS.has(w)) return w;
      return w[0]!.toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/**
 * Return the first complete sentence of a longer block of prose.
 * Used by the entity page to derive a clean epigraph from the Tier 1
 * summary without truncating mid-word.
 */
export function firstSentence(text: string, maxLen = 260): string {
  const trimmed = text.trim();
  // Sentence-end: ., !, ? followed by space + capital letter OR end of input.
  const m = trimmed.match(/^([\s\S]+?[.!?])(?:\s+[A-Z(])/);
  if (m && m[1] && m[1].length <= maxLen) return m[1];
  // Fallback: cap at maxLen on a word boundary.
  if (trimmed.length <= maxLen) return trimmed;
  const slice = trimmed.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : maxLen)}…`;
}

/** Strip combining diacritical marks. */
export function stripDiacritics(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}
