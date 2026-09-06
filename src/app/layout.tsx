import type { Metadata, Viewport } from "next";
import { Archivo, Newsreader } from "next/font/google";
import "./globals.css";

import Nav from "@/components/layout/Nav";
import Gutter from "@/components/layout/Gutter";
import SkipToContent from "@/components/layout/SkipToContent";
import ScrollMotion from "@/components/layout/ScrollMotion";

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

/**
 * Runs before anything paints. If the entrance has already played in this tab
 * it injects a stylesheet that switches every entrance animation off, so a
 * soft navigation back to the home page does not replay it.
 *
 * It appends a style rather than stamping an attribute on the root element:
 * React owns <html>, and an attribute that is on the client but not in the
 * server HTML is a hydration mismatch, which makes React re-render the whole
 * tree and leaves effects half applied. This was that bug.
 */
const SESSION_GATE = [
  "try{",
  "if(sessionStorage.getItem('seen')){",
  "var s=document.createElement('style');",
  "s.textContent='.entrance,.entrance *{animation:none!important}';",
  "document.head.appendChild(s);",
  "}",
  "}catch(e){}",
].join("");

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
        <script dangerouslySetInnerHTML={{ __html: SESSION_GATE }} />
        <SkipToContent />
        <Gutter />
        <Nav />
        <main id="main" className="shell">
          {children}
        </main>
        <ScrollMotion />
      </body>
    </html>
  );
}
