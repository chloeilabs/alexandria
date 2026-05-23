// Dynamic favicon — gilt "L" on deep ink. The dark+gold pairing reads
// at favicon size and matches the site's design language.

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
          fontFamily: "Georgia, serif",
          fontSize: 26,
          fontWeight: 300,
          letterSpacing: -1,
        }}
      >
        L
      </div>
    ),
    size,
  );
}
