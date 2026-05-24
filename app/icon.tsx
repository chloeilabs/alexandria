// Dynamic favicon: the header logo's italic display treatment,
// reduced to a single high-contrast mark for browser-tab size.

import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1320",
          color: "#d6b066",
          fontFamily: "Cormorant Garamond, Georgia, 'Times New Roman', serif",
          fontSize: 29,
          fontStyle: "italic",
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: 0,
        }}
      >
        A
      </div>
    ),
    { ...size },
  );
}
