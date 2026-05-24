import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
      // Europeana preview thumbnails go through its API host.
      { protocol: "https", hostname: "api.europeana.eu" },
    ],
  },
  // typedRoutes disabled — adds friction when routes are added mid-dev
  // and provides little value at our scale. Re-enable later if desired.
};

export default config;
