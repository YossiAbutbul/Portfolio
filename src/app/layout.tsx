import type { Metadata, Viewport } from "next";
import { Archivo, Newsreader } from "next/font/google";
import "./globals.css";

import Nav from "@/components/layout/Nav";
import Gutter from "@/components/layout/Gutter";
import SkipToContent from "@/components/layout/SkipToContent";

/**
 * Two faces, both variable.
 *
 * Archivo carries display, navigation, labels and figures. Its width axis is
 * the site's emphasis mechanism, which is why it is loaded rather than a
 * second weight file. Newsreader carries anything read at length.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
  adjustFontFallback: true,
});

/* Weight axis only. The optical-size axis and the italics were another
   270 KB of font on a page that uses neither. */
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://yossiabutbul.vercel.app/"),
  title: "Yossi Abutbul - Portfolio",
  description:
    "BSc Computer Science student at The Open University and RF & electronics integrator at Arad Technologies. I build test-automation platforms, antenna tooling, and workflow software for engineering labs.",
  authors: [{ name: "Yossi Abutbul" }],
  keywords: [
    "Yossi Abutbul",
    "portfolio",
    "software engineer",
    "BSc Computer Science student",
    "RF integrator",
    "embedded systems",
    "React",
    "TypeScript",
    "Python",
    "FastAPI",
    "test automation",
  ],
  openGraph: {
    title: "Yossi Abutbul - Portfolio",
    description:
      "Portfolio of Yossi Abutbul: software engineer and RF integrator. Test automation, instrument tooling, full-stack engineering.",
    type: "website",
    images: [
      {
        url: "og.png",
        width: 1200,
        height: 630,
        alt: "Yossi Abutbul - software for hardware",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yossi Abutbul - Portfolio",
    images: ["og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0c1114",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${newsreader.variable}`}>
      <body>
        <SkipToContent />
        <Gutter />
        <Nav />
        <main id="main" className="shell">
          {children}
        </main>
      </body>
    </html>
  );
}
