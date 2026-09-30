"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LaunchLoader.module.css";

/** Held at least this long so the drawing gets to finish; never longer than MAX_MS. */
const MIN_MS = 1700;
const MAX_MS = 6000;

/**
 * A blueprint of the device, drawn on an olive sheet while the 3D scene loads: dashed outlines,
 * Bézier handles, construction lines, and a fill that sweeps round with real setup progress.
 * Phones do not load the scene up front, so there the fill runs on the clock instead.
 */
export default function LaunchLoader() {
  const [phase, setPhase] = useState<"loading" | "leaving" | "gone">("loading");
  const wedge = useRef<SVGPathElement>(null);
  const readout = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone = window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
    // Reduced motion: the sheet is hidden by CSS and the page is never held.
    if (reduce) return;

    const start = performance.now();
    let target = 0, shown = 0, frame = 0, left = false;
    const onProgress = (e: Event) => { target = Math.max(target, (e as CustomEvent<number>).detail); };
    window.addEventListener("launch:progress", onProgress);

    // Hold the page at the top while the sheet is up; hand it back exactly where it started.
    const overflowWas = root.style.overflow;
    root.style.overflow = "hidden";
    const muzzle = window.setInterval(() => window.__lenis?.stop(), 80);

    const leave = () => {
      if (left) return; left = true;
      setPhase("leaving");
      window.setTimeout(() => setPhase("gone"), 750);
    };

    const tick = (now: number) => {
      const elapsed = now - start;
      // Phones: a timed sweep. Desktop: the scene's own progress, never ahead of the clock's floor.
      const goal = phone ? Math.min(1, elapsed / MIN_MS) : Math.max(target, Math.min(.2, elapsed / 2000));
      shown += (goal - shown) * .12;
      if (goal >= 1 && shown > .995) shown = 1;
      draw(shown);
      if ((shown >= 1 && elapsed >= MIN_MS) || elapsed >= MAX_MS) { draw(1); leave(); return; }
      frame = requestAnimationFrame(tick);
    };
    function draw(p: number) {
      if (readout.current) readout.current.textContent = `${String(Math.round(p * 100)).padStart(3, "0")}`;
      if (!wedge.current) return;
      // A pie wedge from the device's centre, swept clockwise from twelve o'clock.
      const a = Math.min(p, .9999) * Math.PI * 2, R = 400, cx = 500, cy = 300;
      const x = cx + Math.sin(a) * R, y = cy - Math.cos(a) * R;
      wedge.current.setAttribute("d", p <= 0 ? "" : `M${cx} ${cy} L${cx} ${cy - R} A${R} ${R} 0 ${a > Math.PI ? 1 : 0} 1 ${x} ${y} Z`);
    }
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("launch:progress", onProgress);
      clearInterval(muzzle);
      root.style.overflow = overflowWas;
      window.__lenis?.start();
    };
  }, []);

  useEffect(() => {
    if (phase !== "leaving") return;
    // Release the page as the sheet lifts, so the desk is already live underneath.
    document.documentElement.style.overflow = "";
    window.__lenis?.start();
    window.dispatchEvent(new Event("launch:revealed"));
  }, [phase]);

  if (phase === "gone") return null;

  // Device blueprint in a 1000 x 600 sheet: body 420 x 266 centred, screen, knob and button.
  const handle = (x1: number, y1: number, x2: number, y2: number, big = true, key?: string) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, r = big ? 7 : 4.5, sq = big ? 11 : 7;
    return (
      <g key={key} className={styles.handle}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <circle cx={x1} cy={y1} r={r} />
        <circle cx={x2} cy={y2} r={r} />
        <rect x={mx - sq / 2} y={my - sq / 2} width={sq} height={sq} />
      </g>
    );
  };

  return (
    <div className={styles.sheet} data-launch-loader data-phase={phase} aria-hidden="true">
      <svg className={styles.drawing} viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="loader-fade-x" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".3" stopColor="#fff" /><stop offset=".7" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="loader-fade-y" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".3" stopColor="#fff" /><stop offset=".7" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="loader-mask-x"><rect x="0" y="0" width="1000" height="600" fill="url(#loader-fade-x)" /></mask>
          <mask id="loader-mask-y"><rect x="0" y="-200" width="1000" height="1000" fill="url(#loader-fade-y)" /></mask>
          <clipPath id="loader-body"><rect x="290" y="167" width="420" height="266" rx="34" /></clipPath>
        </defs>

        <g className={styles.construction}>
          <g mask="url(#loader-mask-x)" className={styles.hLines}>
            {[167, 199, 280, 361, 433].map((y) => <line key={y} x1="60" x2="940" y1={y} y2={y} />)}
          </g>
          <g mask="url(#loader-mask-y)" className={styles.vLines}>
            {[290, 307, 437, 567, 633, 710].map((x) => <line key={x} x1={x} x2={x} y1="-120" y2="720" />)}
          </g>
        </g>

        {/* The fill sweeps round the body with progress; the screen stays a window onto the sheet. */}
        <g clipPath="url(#loader-body)">
          <path ref={wedge} className={styles.fill} d="" />
        </g>
        <rect className={styles.screenHole} x="307" y="199" width="260" height="162" rx="10" />

        <g className={styles.outlines}>
          <rect x="290" y="167" width="420" height="266" rx="34" />
          <rect x="307" y="199" width="260" height="162" rx="10" />
          <circle cx="633" cy="247" r="41" />
          <circle cx="633" cy="364" r="31" />
          <line x1="633" y1="212" x2="633" y2="232" />
        </g>

        <g className={styles.handles}>
          {handle(390, 167, 610, 167, true, "t")}
          {handle(390, 433, 610, 433, true, "b")}
          {handle(290, 230, 290, 370, true, "l")}
          {handle(710, 230, 710, 370, true, "r")}
          {handle(387, 199, 487, 199, false, "st")}
          {handle(387, 361, 487, 361, false, "sb")}
          {handle(307, 250, 307, 310, false, "sl")}
          {handle(567, 250, 567, 310, false, "sr")}
          {handle(603, 206, 663, 206, false, "k")}
          {handle(605, 333, 661, 333, false, "bt")}
        </g>
      </svg>
      <div className={styles.meta}>
        <span>Yossi Abutbul</span>
        <span><span ref={readout}>000</span> / 100</span>
      </div>
    </div>
  );
}
