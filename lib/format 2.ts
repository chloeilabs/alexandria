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
      const c = Math.floor(y / 100) + 1;
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

/** Slugified region label → presentation label ("west-african-empires" → "West African Empires"). */
export function regionLabel(slug: string | null | undefined): string {
  if (!slug) return "";
  return slug
    .split("-")
    .map((w) => (w.length === 0 ? "" : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Strip combining diacritical marks. */
export function stripDiacritics(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}
