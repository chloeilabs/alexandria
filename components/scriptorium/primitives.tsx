// SCRIPTORIUM primitives — the small typographic atoms used across the
// codex pages. All theme-aware via CSS vars exposed by globals.css.

import type { CSSProperties, ElementType, ReactNode } from "react";

// ── MonoLabel ──────────────────────────────────────────────────────
// Small uppercase mono label — the workhorse of the editorial language.
// Used for kickers, captions, metadata strips, source attributions.

type MonoLabelProps = {
  children: ReactNode;
  tone?: "muted" | "accent" | "fg";
  track?: string;
  size?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
};

export function MonoLabel({
  children,
  tone = "muted",
  track = "0.22em",
  size = 10,
  as,
  className,
  style,
}: MonoLabelProps) {
  const Tag = (as ?? "span") as ElementType;
  const color =
    tone === "accent"
      ? "var(--color-accent)"
      : tone === "fg"
        ? "var(--color-foreground)"
        : "var(--color-muted-foreground)";
  return (
    <Tag
      className={`font-mono uppercase ${className ?? ""}`}
      style={{
        fontSize: size,
        letterSpacing: track,
        color,
        lineHeight: 1.4,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

// ── Display ────────────────────────────────────────────────────────
// EB Garamond display heading at arbitrary scale. `size` is the desktop
// pixel size; the rendered font-size uses clamp(min, vw-scaled, size)
// so the heading shrinks gracefully on narrow viewports without
// overflowing. The minimum is half the requested size, capped at 28px
// so even the largest headings stay readable on mobile.

type DisplayProps = {
  children: ReactNode;
  size?: number;
  italic?: boolean;
  weight?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
};

function responsiveFontSize(size: number): string {
  // Floor: half the requested size, with a 28px readability floor —
  // but capped at the requested size itself, so a Display passed
  // `size={22}` doesn't produce `clamp(28px, …, 22px)` (which would
  // force the text larger than the caller asked for, since CSS clamp
  // resolves min > max to the min value).
  const floor = Math.min(size, Math.max(28, Math.round(size * 0.5)));
  // Scale roughly proportional to viewport width — 1vw per ~14px of
  // size, derived empirically so 64px lands near 4.5vw and 140px
  // near 10vw. Cap at the requested size on wide screens.
  const vw = (size / 14).toFixed(2);
  return `clamp(${floor}px, ${vw}vw, ${size}px)`;
}

export function Display({
  children,
  size = 64,
  italic = false,
  weight = 400,
  as,
  className,
  style,
}: DisplayProps) {
  const Tag = (as ?? "h1") as ElementType;
  return (
    <Tag
      className={`font-display ${className ?? ""}`}
      style={{
        fontWeight: weight,
        fontStyle: italic ? "italic" : "normal",
        fontSize: responsiveFontSize(size),
        lineHeight: 1.02,
        letterSpacing: "-0.012em",
        color: "var(--color-foreground)",
        margin: 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

// ── Rule ───────────────────────────────────────────────────────────
// Restrained horizontal rule. Default 1px border colour; "accent" for
// emphasised dividers, "double" for folio breaks.

type RuleProps = {
  tone?: "border" | "accent" | "fg";
  variant?: "single" | "double";
  className?: string;
  style?: CSSProperties;
};

export function Rule({
  tone = "border",
  variant = "single",
  className,
  style,
}: RuleProps) {
  const color =
    tone === "accent"
      ? "var(--color-accent)"
      : tone === "fg"
        ? "var(--color-foreground)"
        : "var(--color-border)";
  if (variant === "double") {
    return (
      <div className={className} style={style}>
        <div style={{ height: 1, background: color }} />
        <div style={{ height: 1, background: color, marginTop: 3 }} />
      </div>
    );
  }
  return (
    <div
      className={className}
      style={{ height: 1, background: color, ...style }}
    />
  );
}

// ── Folio ──────────────────────────────────────────────────────────
// The page chrome that wraps each codex section. A small folio number
// + running heads + a hairline below, then the body content.
//
// `verso` (left-hand page in a bound codex) gets the slightly
// elevated paper tone so consecutive folios alternate, like the
// recto/verso of a real opened book.

type FolioProps = {
  /** Verso pages get the slightly-elevated paper tone, alternating
   *  with recto sections so consecutive folios read like the
   *  recto/verso of an opened book. */
  verso?: boolean;
  children: ReactNode;
};

export function Folio({ verso, children }: FolioProps) {
  return (
    <article
      className="px-4 md:px-12 lg:px-20 pt-10 md:pt-14 pb-10 md:pb-12 border-b"
      style={{
        background: verso
          ? "var(--color-background-elevated)"
          : "var(--color-background)",
        borderBottomColor: "var(--color-rule)",
        borderBottomWidth: 1,
        borderBottomStyle: "double",
      }}
    >
      {children}
    </article>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────
// Less-decorated header used outside Folio chrome (entity page,
// civilization list, etc.).

type SectionHeaderProps = {
  kicker: string;
  kickerTone?: "muted" | "accent" | "fg";
  right?: ReactNode;
  withRule?: boolean;
  className?: string;
};

export function SectionHeader({
  kicker,
  kickerTone = "accent",
  right,
  withRule = true,
  className,
}: SectionHeaderProps) {
  return (
    <div className={className}>
      <div
        className="flex items-baseline justify-between"
        style={{
          paddingBottom: withRule ? 10 : 0,
          borderBottom: withRule
            ? "1px solid var(--color-border)"
            : "none",
        }}
      >
        <MonoLabel tone={kickerTone} size={10} track="0.24em">
          {kicker}
        </MonoLabel>
        {right && (
          <MonoLabel tone="muted" size={10} track="0.18em">
            {right}
          </MonoLabel>
        )}
      </div>
    </div>
  );
}

// ── EditorialPageHeader ───────────────────────────────────────────
// Centred SCRIPTORIUM-style page header used by detail pages
// (thread, civilization, era, search). Latin kicker + huge italic
// display + optional italic epigraph + optional meta strip + a
// triple-rule divider closes it.

type EditorialPageHeaderProps = {
  kicker: string;
  title: ReactNode;
  /** Title-display pixel size at desktop; clamped responsively. */
  titleSize?: number;
  italic?: boolean;
  blurb?: ReactNode;
  /** A short metadata strip (e.g. "7 stops · featured"). Mono uppercase. */
  meta?: ReactNode;
  /** Set false to omit the closing triple-rule. */
  divider?: boolean;
  className?: string;
};

export function EditorialPageHeader({
  kicker,
  title,
  titleSize = 72,
  italic = true,
  blurb,
  meta,
  divider = true,
  className,
}: EditorialPageHeaderProps) {
  return (
    <header className={`text-center ${className ?? ""}`}>
      <MonoLabel
        tone="accent"
        size={11}
        track="0.32em"
        className="block mb-3"
      >
        {kicker}
      </MonoLabel>
      <Display
        size={titleSize}
        italic={italic}
        style={{ letterSpacing: "-0.015em", lineHeight: 1.02 }}
      >
        {title}
      </Display>
      {blurb && (
        <p
          className="font-display italic mx-auto mt-5"
          style={{
            fontSize: 18,
            lineHeight: 1.55,
            color: "var(--color-muted-foreground)",
            maxWidth: 640,
          }}
        >
          {blurb}
        </p>
      )}
      {meta && (
        <div className="mt-5">
          <MonoLabel tone="muted" size={10} track="0.22em">
            {meta}
          </MonoLabel>
        </div>
      )}
      {divider && (
        <div className="mx-auto mt-7" style={{ width: 240 }}>
          <div
            style={{
              height: 1,
              background: "var(--color-rule)",
              marginBottom: 4,
            }}
          />
          <div
            style={{
              height: 3,
              background: "var(--color-accent)",
              marginBottom: 4,
            }}
          />
          <div style={{ height: 1, background: "var(--color-rule)" }} />
        </div>
      )}
    </header>
  );
}
