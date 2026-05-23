// OG image for /era (index).

import { ImageResponse } from "next/og";

export const alt = "Alexandria · Eras";
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
          padding: "64px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 18,
            color: "#a89d8a",
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          Alexandria
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
            Five eras
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 160,
              fontWeight: 300,
              lineHeight: 0.96,
              color: "#f6f5f0",
              letterSpacing: -3,
            }}
          >
            By era
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "Georgia, serif",
            fontSize: 22,
            fontStyle: "italic",
            color: "#a89d8a",
            maxWidth: 800,
          }}
        >
          Five windows across five thousand years. Pick one and read across
          the world at once.
        </div>
      </div>
    ),
    { ...size },
  );
}
