import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import Nav from "@/components/layout/Nav";
import SkipToContent from "@/components/layout/SkipToContent";
import SmoothScroll from "@/components/layout/SmoothScroll";
import PageTransition from "@/components/layout/PageTransition";
import SheetMarks from "@/components/layout/SheetMarks";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://yossiabutbul.vercel.app/"),
  title: "Yossi Abutbul",
  description:
    "I build test automation, measurement software, and the interfaces that make lab data readable. One platform took a three-day RF test cycle down to about eight minutes.",
  authors: [{ name: "Yossi Abutbul" }],
  keywords: [
    "Yossi Abutbul",
    "portfolio",
    "test automation",
    "measurement software",
    "RF integration",
    "React",
    "TypeScript",
    "Python",
    "FastAPI",
  ],
  openGraph: {
    title: "Yossi Abutbul",
    description:
      "Test automation, measurement software, and the interfaces that make lab data readable.",
    type: "website",
    images: [
      {
        url: "og.png",
        width: 1200,
        height: 630,
        alt: "Yossi Abutbul",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yossi Abutbul",
    images: ["og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#ECEBE5",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${jetbrains.variable}`}
      data-theme="light"
    >
      <body>
        <SkipToContent />
        <SheetMarks />
        <SmoothScroll>
          <Nav />
          <main id="main">
            <PageTransition>{children}</PageTransition>
          </main>
        </SmoothScroll>
      </body>
    </html>
  );
}
