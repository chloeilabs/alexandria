// Per-entity OG image. Renders a 1200×630 PNG via next/og — large display
// name, dates / type / region in mono, on a deep ink panel with the entity's
// hero image faintly tinted in the background if available.

import { ImageResponse } from "next/og";
import { getEntityBySlug } from "@/lib/db/queries/entity";
import {
  fmtDateRange,
  regionLabel,
} from "@/lib/format";

export const alt = "Alexandria";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";
// postgres-js requires Node's net module — opengraph-image routes default
// to Edge runtime in Next.js, which breaks DB queries that reach Neon.
export const runtime = "nodejs";

interface Props {
  params: { slug: string };
}

export default async function Image({ params }: Props) {
  const data = await getEntityBySlug(params.slug);

  const name = data?.entity.name ?? "Alexandria";
  const dateRange = data
    ? fmtDateRange(
        data.entity.dateStart,
        data.entity.dateStartPrecision,
        data.entity.dateEnd,
        data.entity.dateEndPrecision,
      )
    : "";
  const region = data?.primaryTag ? regionLabel(data.primaryTag) : "";
  const type =
    data?.entity.type?.[0]?.toUpperCase() + (data?.entity.type?.slice(1) ?? "");

  const heroUrl = data?.media[0]?.url;
  const metaLine = [type, dateRange, region].filter(Boolean).join("  ·  ");

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
        {/* Background hero (low-opacity wash, right side) */}
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

        {/* Masthead */}
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

        {/* Title block */}
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
              fontSize: name.length > 24 ? 84 : 110,
              fontWeight: 300,
              lineHeight: 1.02,
              color: "#f6f5f0",
              letterSpacing: -2,
            }}
          >
            {name}
          </div>
        </div>

        {/* Footer */}
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
