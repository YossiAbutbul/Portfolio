import type { Metadata, Viewport } from "next";
import { Caveat, Figtree, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

import Nav from "@/components/layout/Nav";
import SkipToContent from "@/components/layout/SkipToContent";
import SmoothScroll from "@/components/layout/SmoothScroll";
import PageTransition from "@/components/layout/PageTransition";
import Scrollbar from "@/components/layout/Scrollbar";
import { PROFILES, SITE_URL } from "@/lib/site";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

// Handwriting for the notebooks: the one on the desk and the More work section. Below the fold, so it
// is not preloaded.
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}/`),
  title: "Yossi Abutbul",
  description:
    "Test automation and measurement software for RF hardware. One platform took a three-day qualification cycle down to about eight minutes.",
  authors: [{ name: "Yossi Abutbul" }],
  // Google Search Console ownership; keep it, or the property is unverified again.
  verification: { google: "pYABdJLNaQBHh8YX70VoW-vl9Ag92KDlPSHGnn3byuA" },
  keywords: [
    "Yossi Abutbul",
    "portfolio",
    "test automation",
    "measurement software",
    "RF integration",
    "LLM",
    "AI tooling",
    "React",
    "TypeScript",
    "Python",
    "FastAPI",
  ],
  openGraph: {
    title: "Yossi Abutbul",
    description:
      "Test automation and measurement software for RF hardware.",
    type: "website",
    images: [
      {
        url: "og.jpg",
        width: 1200,
        height: 630,
        alt: "The name Yossi Abutbul over a desk with a handheld device, an open notebook, a pencil, an eraser and a mug",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yossi Abutbul",
    images: ["og.jpg"],
  },
};

// Tells search engines the site, the GitHub and the LinkedIn profiles are one person, so a search
// for the name finds them together.
const person = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Yossi Abutbul",
  url: `${SITE_URL}/`,
  image: `${SITE_URL}/og.jpg`,
  sameAs: PROFILES,
};

export const viewport: Viewport = {
  themeColor: "#17110e",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${caveat.variable} ${jetbrains.variable}`}
      data-theme="dark"
      // The head script below may mark the document before React hydrates.
      suppressHydrationWarning
    >
      <head>
        {/* The loading sheet plays once per tab: a reload (or coming back from a project page) skips
            it. Read before first paint so the sheet never flashes. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("launch:seen"))document.documentElement.setAttribute("data-seen","")}catch(e){}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(person) }}
        />
      </head>
      <body>
        <SkipToContent />
        <SmoothScroll>
          <Nav />
          <main id="main">
            <PageTransition>{children}</PageTransition>
          </main>
        </SmoothScroll>
        <Scrollbar />
        {/* Cookieless page views and real-visitor vitals; both scripts load deferred, after the page. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
