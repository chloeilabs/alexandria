import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
      // Museum-API media hosts (see lib/met, lib/smithsonian, lib/europeana).
      // Met serves CC0 images directly from images.metmuseum.org.
      { protocol: "https", hostname: "images.metmuseum.org" },
      // Smithsonian IDS image server (most units route through this).
      { protocol: "https", hostname: "ids.si.edu" },
      // Europeana preview thumbnails go through its API host.
      { protocol: "https", hostname: "api.europeana.eu" },
    ],
  },
  // typedRoutes disabled — adds friction when routes are added mid-dev
  // and provides little value at our scale. Re-enable later if desired.
};

export default config;
