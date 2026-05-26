// Themed archival placeholder, used when an entity has no Commons hero
// image. Deterministic look per slug (rotation, stripe width, dot
// position) so each entry has a stable visual signature.

import type { CSSProperties } from "react";

const TONE_PALETTES: Record<string, [string, string, string]> = {
  gilt:      ["oklch(0.42 0.06 75)",  "oklch(0.30 0.05 65)",  "oklch(0.78 0.13 80)"],
  vermilion: ["oklch(0.40 0.08 30)",  "oklch(0.26 0.06 25)",  "oklch(0.68 0.16 35)"],
  stone:     ["oklch(0.45 0.01 80)",  "oklch(0.30 0.008 80)", "oklch(0.78 0.02 80)"],
  sand:      ["oklch(0.50 0.04 70)",  "oklch(0.34 0.03 60)",  "oklch(0.80 0.06 75)"],
  clay:      ["oklch(0.44 0.05 50)",  "oklch(0.30 0.04 45)",  "oklch(0.76 0.08 55)"],
  indigo:    ["oklch(0.32 0.07 255)", "oklch(0.22 0.05 255)", "oklch(0.65 0.11 250)"],
  silk:      ["oklch(0.46 0.03 110)", "oklch(0.32 0.02 110)", "oklch(0.80 0.05 105)"],
  crimson:   ["oklch(0.38 0.09 20)",  "oklch(0.24 0.07 20)",  "oklch(0.66 0.13 25)"],
  andean:    ["oklch(0.40 0.07 60)",  "oklch(0.28 0.05 55)",  "oklch(0.74 0.10 65)"],
  ash:       ["oklch(0.40 0.01 230)", "oklch(0.26 0.01 230)", "oklch(0.70 0.02 230)"],
  sea:       ["oklch(0.36 0.05 220)", "oklch(0.24 0.04 220)", "oklch(0.68 0.08 220)"],
};

const TONE_BY_REGION_HINT: Array<[RegExp, string]> = [
  [/west african|mali|songhai/i, "gilt"],
  [/china|tang|heian|japan/i, "vermilion"],
  [/india|mughal|vedic/i, "crimson"],
  [/mediterranean|carthage|greek|roman/i, "stone"],
  [/egypt|new kingdom/i, "sand"],
  [/mesopotamia|levant/i, "clay"],
  [/islamic|caliphate|ayyubid/i, "indigo"],
  [/andean|peru|inca/i, "andean"],
  [/silk roads?|silk-road/i, "sea"],
  [/austronesian|polynesian|oceanian/i, "sea"],
  [/mesoamerican|aztec|maya/i, "vermilion"],
  [/bronze|aegean/i, "ash"],
];

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function toneFor(hint: string | null | undefined, fallback = "stone"): string {
  if (!hint) return fallback;
  for (const [re, tone] of TONE_BY_REGION_HINT) {
    if (re.test(hint)) return tone;
  }
  return fallback;
}

type Props = {
  slug: string;
  tone?: string;
  caption?: string | null;
  tier?: number;
  /** Pixel height; ignored when aspectRatio is given. */
  height?: number;
  /** CSS aspect-ratio e.g. "21/9". */
  aspectRatio?: string;
  showCaption?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function PlaceholderPlate({
  slug,
  tone = "stone",
  caption,
  tier,
  height = 280,
  aspectRatio,
  showCaption = true,
  className,
  style,
}: Props) {
  const [dark, mid, hot] = TONE_PALETTES[tone] ?? TONE_PALETTES.stone!;
  const seed = hashSeed(slug || "x");
  const stripeRotation = (seed % 7) * 9 + 22;
  const stripeWidth = 5 + (seed % 4);
  const dotX = ((seed >> 3) % 60) + 20;
  const dotY = ((seed >> 7) % 60) + 20;

  return (
    <div
      className={`relative overflow-hidden w-full ${className ?? ""}`}
      style={{
        ...(aspectRatio ? { aspectRatio } : { height }),
        background: `linear-gradient(135deg, ${dark} 0%, ${mid} 100%)`,
        ...style,
      }}
      aria-hidden={!caption}
      role={caption ? "img" : undefined}
      aria-label={caption ?? undefined}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: -10,
          background: `repeating-linear-gradient(${stripeRotation}deg, transparent 0 ${stripeWidth}px, ${hot}1f ${stripeWidth}px ${stripeWidth + 1}px)`,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: `${dotX}%`,
          top: `${dotY}%`,
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: `1px solid ${hot}66`,
          mixBlendMode: "overlay",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 40%, ${dark}90 100%)`,
        }}
      />
      {showCaption && caption && (
        <div
          className="font-mono uppercase"
          style={{
            position: "absolute",
            left: 12,
            bottom: 10,
            fontSize: 9,
            letterSpacing: "0.18em",
            color: "#fff",
            opacity: 0.78,
          }}
        >
          plate · {caption}
        </div>
      )}
      {tier === 3 && (
        <div
          className="font-mono uppercase"
          style={{
            position: "absolute",
            right: 12,
            top: 10,
            fontSize: 8,
            letterSpacing: "0.22em",
            color: "var(--color-accent)",
            opacity: 0.85,
          }}
        >
          tier 3 · anchor
        </div>
      )}
    </div>
  );
}
