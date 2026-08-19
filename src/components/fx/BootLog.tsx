"use client";

import { useEffect } from "react";

/**
 * DevTools easter egg - logs a compact "boot" banner the first time the site
 * is opened. Zero visible UI cost; discoverable by anyone who opens the console.
 */
export default function BootLog() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as unknown as { __ya_boot__?: boolean }).__ya_boot__) return;
    (window as unknown as { __ya_boot__?: boolean }).__ya_boot__ = true;

    const bannerStyle = [
      "color:#e23614",
      "font-family:ui-monospace,Menlo,monospace",
      "font-size:12px",
      "line-height:1.1",
    ].join(";");
    const dimStyle = "color:#8a857c;font-family:ui-monospace,Menlo,monospace;font-size:11px";
    const lblStyle = "color:#ece7df;font-family:ui-monospace,Menlo,monospace;font-size:11px";

    // Monogram - compact
    // eslint-disable-next-line no-console
    console.log(
      [
        "",
        "  __ __  ___   ",
        "  \\ V / / _ \\  ",
        "   \\_/  \\_/\\_\\ ",
        "",
      ].join("\n"),
      bannerStyle,
    );
    // eslint-disable-next-line no-console
    console.log("%cboot     : %cok", dimStyle, lblStyle);
    // eslint-disable-next-line no-console
    console.log("%clinker   : %cok", dimStyle, lblStyle);
    // eslint-disable-next-line no-console
    console.log(
      "%c.text    : %cTypeScript · React · Python · ANSI C · FastAPI",
      dimStyle,
      lblStyle,
    );
    // eslint-disable-next-line no-console
    console.log(
      "%c.data    : %cRF · antennas · LoRa · LTE · NB-IoT · Bluetooth · spectrum",
      dimStyle,
      lblStyle,
    );
    // eslint-disable-next-line no-console
    console.log("%c--", dimStyle);
    // eslint-disable-next-line no-console
    console.log(
      "%cabyossi22@gmail.com  ·  github.com/YossiAbutbul",
      "color:#e23614;font-family:ui-monospace,Menlo,monospace;font-size:11px",
    );
  }, []);

  return null;
}
