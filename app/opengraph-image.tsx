// Root OG image — the social card any time someone shares the home URL.
// Same deep-ink panel as the other OG images, but no DB lookup. Just the
// brand and the tagline.

import { ImageResponse } from "next/og";

export const alt = "Alexandria";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image() {
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
          padding: "72px 88px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 20,
            color: "#a89d8a",
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          Alexandria
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
            A digital encyclopedia
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 160,
              fontWeight: 300,
              lineHeight: 0.92,
              color: "#f6f5f0",
              letterSpacing: -4,
            }}
          >
            of human
            <br />
            civilization
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "Georgia, serif",
            fontSize: 22,
            fontStyle: "italic",
            color: "#a89d8a",
            maxWidth: 700,
          }}
        >
          Begin anywhere; follow the threads.
        </div>
      </div>
    ),
    { ...size },
  );
}
