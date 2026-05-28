import type { NextConfig } from "next";

const config: NextConfig = {
  // No third-party image hosts: imagery is not a feature of the new
  // AI-distilled corpus.
  images: { remotePatterns: [] },
};

export default config;
