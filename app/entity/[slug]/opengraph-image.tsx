import { ImageResponse } from "next/og";

import { getEntityFull } from "@/lib/db/queries/entity";

// Node runtime: getEntityFull hits Postgres via postgres-js, which is
// not edge-compatible. Edge runtime would crash on first DB call.
export const runtime = "nodejs";
export const alt = "Alexandria entry";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#1a1714";
const INK = "#f0e8da";
const ACCENT = "#b58739";
const RULE = "#3a342c";

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await getEntityFull(slug);

  // Fall back to the default OG when the slug is unknown — rather than
  // emitting an explicit error image. Crawlers tolerate this gracefully.
  if (!entity) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: PAPER,
            color: INK,
            fontSize: 64,
            fontStyle: "italic",
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}
        >
          Alexandria
        </div>
      ),
      size,
    );
  }

  const consensus = Number(entity.consensusScore ?? 1);
  const consensusBand =
    consensus >= 1 ? "high confidence" : consensus >= 0.7 ? "moderate" : "flagged";
  const consensusLabel = `consensus ${consensus.toFixed(2)} · ${consensusBand}`;

  // Truncate description to ~220 chars for clean wrapping at 36px.
  const desc = (entity.shortDescription ?? "").slice(0, 240);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          color: INK,
          padding: "72px 80px",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 18,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: ACCENT,
            fontFamily: "ui-monospace, monospace",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex" }}>¶ {entity.entityType}</div>
          {entity.disambiguator ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ opacity: 0.6 }}>·</div>
              <div style={{ opacity: 0.8 }}>{entity.disambiguator}</div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            justifyContent: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontStyle: "italic",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            {entity.canonicalName}
          </div>
          {desc ? (
            <div
              style={{
                display: "flex",
                fontSize: 32,
                fontStyle: "italic",
                lineHeight: 1.35,
                opacity: 0.85,
                maxWidth: 920,
              }}
            >
              {desc}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${RULE}`,
            paddingTop: 24,
            fontSize: 22,
            fontFamily: "ui-monospace, monospace",
            color: ACCENT,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          <div>alexandria.chloei.ai</div>
          <div style={{ opacity: 0.85 }}>{consensusLabel}</div>
        </div>
      </div>
    ),
    size,
  );
}
