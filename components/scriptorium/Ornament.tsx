// Engraved publisher's vignette — central diamond + flanking
// lozenges + hairline rules. The diamond carries a "hole" matching
// the surrounding paper so the mark reads as ringed inlay, not a
// solid shape. Used as the page's opening flourish (frontispiece)
// and closing mark (footer); they bookend the volume.

import type { CSSProperties } from "react";

type Props = {
  /** Pixel cap for the rendered SVG width. Defaults to 320. */
  maxWidth?: number;
  /** Paper tone behind the diamond's centre hole. The frontispiece
   *  sits on `--color-background`; the footer sits on `--color-
   *  background-elevated`. */
  hollowFill?: string;
  className?: string;
  style?: CSSProperties;
};

export function Ornament({
  maxWidth = 320,
  hollowFill = "var(--color-background)",
  className,
  style,
}: Props) {
  return (
    <div
      className={`mx-auto ${className ?? ""}`}
      style={{ width: "100%", maxWidth, ...style }}
    >
      <svg
        viewBox="0 0 320 24"
        aria-hidden="true"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <line
          x1="20"
          y1="12"
          x2="125"
          y2="12"
          stroke="var(--color-rule)"
          strokeWidth="1"
        />
        <line
          x1="195"
          y1="12"
          x2="300"
          y2="12"
          stroke="var(--color-rule)"
          strokeWidth="1"
        />
        <path
          d="M 134 9 L 140 12 L 134 15 L 128 12 Z"
          fill="var(--color-rule)"
        />
        <path
          d="M 186 9 L 192 12 L 186 15 L 180 12 Z"
          fill="var(--color-rule)"
        />
        <path
          d="M 160 2 L 170 12 L 160 22 L 150 12 Z"
          fill="var(--color-accent)"
        />
        <circle cx="160" cy="12" r="2.2" fill={hollowFill} />
      </svg>
    </div>
  );
}
