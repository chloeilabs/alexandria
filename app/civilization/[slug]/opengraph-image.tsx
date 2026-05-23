// OG image for /civilization/[slug]. Same deep-ink ink-and-gold treatment
// as the entity OG, but with the civ's display label as the headline and
// the first entry's hero image used as the background wash.

import { ImageResponse } from "next/og";
import { getCivilizationBySlug } from "@/lib/db/queries/civilization";
import { fmtYear, regionLabel } from "@/lib/format";

export const alt = "Alexandria";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";
// postgres-js needs Node's net module — Edge runtime (next/og's default
// for opengraph-image routes) breaks our DB queries here. Era OG appears
// to work at Edge but pulls less data; entity + civ OG don't.
export const runtime = "nodejs";

interface Props {
  // In Next.js 15+ params is a Promise — failing to await it gives
  // undefined for .slug and the query receives the wrong input.
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const data = await getCivilizationBySlug(slug);
  const label = regionLabel(slug);

  const span =
    data && data.minYear != null && data.maxYear != null
      ? `${fmtYear(data.minYear)} – ${fmtYear(data.maxYear)}`
      : "";
  const entryLine = data
    ? `${data.entryCount} ${data.entryCount === 1 ? "entry" : "entries"}`
    : "";
  const metaLine = ["Civilization", span, entryLine]
    .filter(Boolean)
    .join("  ·  ");
  const heroUrl = data?.entries.find((e) => e.heroUrl)?.heroUrl ?? undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0d1320",
          color: "#f6f5f0",
          fontFamily: "Georgia, serif",
          padding: "64px 80px",
          position: "relative",
        }}
      >
        {heroUrl && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "55%",
              height: "100%",
              opacity: 0.18,
              backgroundImage: `url(${heroUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              display: "flex",
            }}
          />
        )}

        <div
          style={{
            display: "flex",
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 18,
            color: "#a89d8a",
            letterSpacing: 4,
            textTransform: "uppercase",
            position: "relative",
            zIndex: 1,
          }}
        >
          Alexandria
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            position: "relative",
            zIndex: 1,
            maxWidth: "75%",
          }}
        >
          {metaLine && (
            <div
              style={{
                display: "flex",
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 22,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: "#d6b066",
              }}
            >
              {metaLine}
            </div>
          )}
          <div
            style={{
              display: "flex",
              fontSize: label.length > 24 ? 84 : 110,
              fontWeight: 300,
              lineHeight: 1.02,
              color: "#f6f5f0",
              letterSpacing: -2,
            }}
          >
            {label}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 16,
            color: "#a89d8a",
            letterSpacing: 4,
            textTransform: "uppercase",
            position: "relative",
            zIndex: 1,
          }}
        >
          A digital encyclopedia of human civilization
        </div>
      </div>
    ),
    { ...size },
  );
}
