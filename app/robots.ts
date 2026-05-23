// Dynamic robots.txt. The two rules that matter:
//   - allow everything by default
//   - disallow /random (redirects per-request, would create infinite crawler
//     loops chasing target URLs) and /api/* (programmatic endpoints, not
//     intended for indexing)
// Plus the sitemap pointer so crawlers find the URL list immediately.

import type { MetadataRoute } from "next";

const BASE_URL = "https://alexandria-chloei.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/random", "/api/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
