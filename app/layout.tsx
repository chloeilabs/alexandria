import type { Metadata } from "next";
import {
  Inter,
  EB_Garamond,
  Cormorant_Garamond,
  JetBrains_Mono,
} from "next/font/google";
import { SiteNav } from "@/components/nav/SiteNav";
import { SiteFooter } from "@/components/nav/SiteFooter";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { APP_DESCRIPTION } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-eb-garamond",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Alexandria",
  description: APP_DESCRIPTION,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// Inlined no-flash theme script. Runs before paint to apply the stored
// theme (or the system preference) so the page never flickers between
// light and dark. Kept dependency-free; reads localStorage('theme').
//
// Also honours ?theme=light|dark in the URL — a small debug hook that
// lets you preview either mode without touching localStorage or
// system prefs. The query param wins for that page load only; it
// does NOT persist.
const themeInitScript = `
(function () {
  try {
    var qs = new URLSearchParams(window.location.search);
    var override = qs.get('theme');
    var stored = localStorage.getItem('theme');
    var theme = (override === 'light' || override === 'dark')
      ? override
      : (stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (_) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${ebGaramond.variable} ${cormorant.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link
          rel="preconnect"
          href="https://upload.wikimedia.org"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://upload.wikimedia.org" />
      </head>
      <body className="antialiased flex flex-col min-h-screen">
        {/* Skip link — invisible until focused, lets keyboard users jump
            past the nav. Standard a11y pattern. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:text-foreground focus:px-3 focus:py-2 focus:border focus:border-accent focus:font-mono focus:text-[11px] focus:uppercase focus:tracking-[0.22em] focus:no-underline"
        >
          Skip to content
        </a>
        <SiteNav />
        <div id="main-content" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </div>
        <SiteFooter />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
