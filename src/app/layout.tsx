import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

import Nav from "@/components/layout/Nav";
import SkipToContent from "@/components/layout/SkipToContent";
import SmoothScroll from "@/components/layout/SmoothScroll";
import BackToTop from "@/components/ui/BackToTop";
import PageTransition from "@/components/layout/PageTransition";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
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
      "Portfolio of Yossi Abutbul: BSc Computer Science student + RF integrator. Test-automation, antenna tooling, full-stack engineering.",
    type: "website",
    images: [
      {
        url: "og.png",
        width: 1200,
        height: 630,
        alt: "Yossi Abutbul - Software for RF and embedded systems",
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
  themeColor: "#1a1614",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${jetbrains.variable}`}
      data-theme="dark"
    >
      <body>
        <SkipToContent />
        <SmoothScroll>
          <Nav />
          <main id="main">
            <PageTransition>{children}</PageTransition>
          </main>
        </SmoothScroll>
        <BackToTop />
      </body>
    </html>
  );
}
