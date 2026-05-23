// Live CSS-variable readers for canvas/WebGL components. The Tailwind v4
// @theme block in app/globals.css is the source of truth — these helpers
// just resolve the variable names at render time so theme changes work.

const FALLBACKS = {
  background: "#0d1320",
  foreground: "#f6f5f0",
  accent: "#d6b066",
  muted: "#a89d8a",
  border: "#3a4150",
  card: "#181d2a",
} as const;

export type ColorRole = keyof typeof FALLBACKS;

const ROLE_TO_VAR: Record<ColorRole, string> = {
  background: "--color-background",
  foreground: "--color-foreground",
  accent: "--color-accent",
  muted: "--color-muted-foreground",
  border: "--color-border",
  card: "--color-card",
};

export function color(role: ColorRole): string {
  const fallback = FALLBACKS[role];
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(ROLE_TO_VAR[role])
    .trim();
  return v || fallback;
}

/**
 * Stable HSL/OKLCH hue per string (e.g., civilizational tag). Used by
 * the graph to color clusters consistently across renders.
 */
export function hueFor(seed: string | null | undefined): string {
  if (!seed) return "oklch(0.6 0.05 240)";
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `oklch(0.72 0.11 ${hue})`;
}
