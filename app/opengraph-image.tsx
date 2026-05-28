import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Alexandria — an AI-distilled knowledge base";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#1a1714";
const INK = "#f0e8da";
const ACCENT = "#b58739";
const RULE = "#3a342c";

export default async function OG() {
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
            fontSize: 18,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: ACCENT,
            fontFamily: "ui-monospace, monospace",
            marginBottom: 24,
          }}
        >
          <div>¶ The Library</div>
        </div>

        <div
          style={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 120,
              fontStyle: "italic",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              marginBottom: 24,
            }}
          >
            Alexandria
          </div>
          <div
            style={{
              fontSize: 36,
              fontStyle: "italic",
              lineHeight: 1.3,
              opacity: 0.8,
              maxWidth: 920,
            }}
          >
            An AI-distilled knowledge base, designed for AI agents to call as a tool.
          </div>
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
          <div style={{ opacity: 0.6 }}>llm-claimed · not verified</div>
        </div>
      </div>
    ),
    size,
  );
}
