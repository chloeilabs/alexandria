import type { Metadata } from "next";
import { Inter, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import { SiteNav } from "@/components/nav/SiteNav";
import { SiteFooter } from "@/components/nav/SiteFooter";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
  description:
    "A living digital encyclopedia of human civilization — from the Indus Valley to the Songhai Empire to the present day.",
};

// Without this, mobile browsers render the page at a 980px default
// viewport width and zoom out — text becomes unreadable on phones.
// initialScale=1 + width=device-width is the standard mobile baseline.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Don't disable user zoom — that's an accessibility regression.
  // maximumScale = 5 is what iOS Safari treats as the practical cap.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${jetbrains.variable}`}
    >
      <head>
        {/* Preconnect to Wikimedia origins — every entity page that has
            hero imagery hits upload.wikimedia.org for the next/image
            optimization fetch (or proxies through the Next.js loader).
            The preconnect cuts ~100-200ms off the first hero load by
            getting the DNS lookup + TLS handshake in flight before the
            image request needs to be made. */}
        <link
          rel="preconnect"
          href="https://upload.wikimedia.org"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://upload.wikimedia.org" />
      </head>
      <body className="antialiased flex flex-col min-h-screen">
        <SiteNav />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
