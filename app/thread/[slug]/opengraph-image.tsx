// OG image for /thread/[slug]. Headline is the thread title with the
// blurb as a meta line and the first entry's hero image as the wash.

import { ImageResponse } from "next/og";
import { getThreadBySlug } from "@/lib/db/queries/thread";
import { APP_DESCRIPTION } from "@/lib/site";

export const alt = "Alexandria";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const data = await getThreadBySlug(slug);

  const title = data?.title ?? "Alexandria";
  const blurb = data?.blurb ?? "";
  const heroUrl = data?.entries.find((e) => e.heroUrl)?.heroUrl ?? undefined;
  const stops = data ? `${data.entries.length} stops` : "";

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
          Alexandria · Thread
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            position: "relative",
            zIndex: 1,
            maxWidth: "82%",
          }}
        >
          {stops && (
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
              {stops}
            </div>
          )}
          <div
            style={{
              display: "flex",
              fontSize: title.length > 28 ? 78 : 100,
              fontWeight: 300,
              lineHeight: 1.02,
              color: "#f6f5f0",
              letterSpacing: -2,
            }}
          >
            {title}
          </div>
          {blurb && (
            <div
              style={{
                display: "flex",
                fontFamily: "Georgia, serif",
                fontSize: 26,
                fontStyle: "italic",
                color: "#a89d8a",
                lineHeight: 1.3,
                marginTop: 8,
              }}
            >
              {blurb}
            </div>
          )}
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
          {APP_DESCRIPTION}
        </div>
      </div>
    ),
    { ...size },
  );
}
