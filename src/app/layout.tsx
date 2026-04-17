import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import Nav from "@/components/layout/Nav";
import SkipToContent from "@/components/layout/SkipToContent";
import SmoothScroll from "@/components/layout/SmoothScroll";
import FollowerDot from "@/components/fx/FollowerDot";
import BackToTop from "@/components/ui/BackToTop";
import BootLog from "@/components/fx/BootLog";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://yossiabutbul.github.io/Portfolio/"),
  title: "Yossi Abutbul — Software for RF and embedded systems",
  description:
    "CS student at The Open University and RF & electronics integrator at Arad Technologies. I build test-automation platforms, antenna tooling, and workflow software for engineering labs.",
  authors: [{ name: "Yossi Abutbul" }],
  keywords: [
    "Yossi Abutbul",
    "portfolio",
    "CS student",
    "RF integrator",
    "embedded systems",
    "React",
    "TypeScript",
    "Python",
    "FastAPI",
    "test automation",
  ],
  openGraph: {
    title: "Yossi Abutbul — Software for RF and embedded systems",
    description:
      "Portfolio of Yossi Abutbul: CS student + RF integrator. Test-automation, antenna tooling, full-stack engineering.",
    type: "website",
    images: [
      {
        url: "og.png",
        width: 1200,
        height: 630,
        alt: "Yossi Abutbul — Software for RF and embedded systems",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yossi Abutbul — Portfolio",
    images: ["og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body>
        <SkipToContent />
        <SmoothScroll>
          <Nav />
          <main id="main">{children}</main>
        </SmoothScroll>
        <BackToTop />
        <FollowerDot />
        <BootLog />
      </body>
    </html>
  );
}
