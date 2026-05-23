// OG image for /era/[slug]. Same template as the civ OG; headline is
// "The {label} era".

import { ImageResponse } from "next/og";
import { getEraBySlug } from "@/lib/db/queries/era";
import { fmtYear } from "@/lib/format";

export const alt = "Alexandria";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";
// Force Node runtime so postgres-js works (Edge is the next/og default).
export const runtime = "nodejs";

interface Props {
  params: { slug: string };
}

export default async function Image({ params }: Props) {
  const data = await getEraBySlug(params.slug);
  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#0d1320",
            color: "#f6f5f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Georgia, serif",
            fontSize: 96,
          }}
        >
          Alexandria
        </div>
      ),
      { ...size },
    );
  }

  const title = `The ${data.label} era`;
  const span = `${fmtYear(data.min)} – ${fmtYear(data.max)}`;
  const entryLine = `${data.entryCount} ${data.entryCount === 1 ? "entry" : "entries"}`;
  const metaLine = ["Era", span, entryLine].join("  ·  ");
  const heroUrl = data.entries.find((e) => e.heroUrl)?.heroUrl ?? undefined;

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
          <div
            style={{
              display: "flex",
              fontSize: 110,
              fontWeight: 300,
              lineHeight: 1.02,
              color: "#f6f5f0",
              letterSpacing: -2,
            }}
          >
            {title}
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
