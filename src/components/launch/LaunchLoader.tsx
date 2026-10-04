"use client";

import { cloneElement, useEffect, useRef, useState } from "react";
import styles from "./LaunchLoader.module.css";

/** When the sheet starts to lift; LaunchLoader.module.css and LaunchIntro.module.css use the same
 *  times (--lift), so the sheet and the hero's entrance run on CSS alone even if scripts are slow. */
const LIFT_MS = 1600;
/** On a reload in the same tab. */
const LIFT_SEEN_MS = 1000;
let firstMount = true;

/**
 * A blueprint of the device, drawn on a dark sheet as the page opens: dashed outlines, Bézier
 * handles, construction lines, and a fill that sweeps round as it is drawn. It is a short title card,
 * not a loading screen: it lifts on its own clock and never waits for the 3D scene (the desk's poster
 * stands in until the scene is ready), so the hero's words are up within about two seconds.
 */
export default function LaunchLoader() {
  const [phase, setPhase] = useState<"loading" | "leaving" | "gone">("loading");
  const wedge = useRef<SVGPathElement>(null);
  const readout = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Reduced motion: the sheet is hidden by CSS and the page is never held.
    if (reduce) return;
    // Seen already in this tab (a reload): the sheet lifts sooner.
    const liftMs = root.hasAttribute("data-seen") ? LIFT_SEEN_MS : LIFT_MS;

    // On the page's first load the clock starts with the page, as the CSS animations do, not when
    // React gets here; coming back from another page it starts now.
    const start = firstMount ? 0 : performance.now();
    firstMount = false;
    let frame = 0, left = false;

    // Hold the page at the top while the sheet is up; hand it back exactly where it started.
    const overflowWas = root.style.overflow;
    root.style.overflow = "hidden";
    const muzzle = window.setInterval(() => window.__lenis?.stop(), 80);

    const leave = () => {
      if (left) return; left = true;
      try { sessionStorage.setItem("launch:seen", "1"); } catch {}
      // Stop holding the page the moment the sheet starts to lift.
      clearInterval(muzzle);
      root.style.overflow = overflowWas;
      window.__lenis?.start();
      setPhase("leaving");
      window.setTimeout(() => setPhase("gone"), 750);
    };

    const tick = (now: number) => {
      const elapsed = now - start;
      // Eased in and out over the sheet's time, by the clock (a late frame moves it further).
      const t = Math.min(1, elapsed / liftMs);
      draw(t * t * (3 - 2 * t));
      if (elapsed >= liftMs) { draw(1); leave(); return; }
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
    document.documentElement.setAttribute("data-entering", "");
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
          {/* Ruled in one after another, each from its starting end, like a pen across the sheet. */}
          <g mask="url(#loader-mask-x)" className={styles.hLines}>
            {[167, 199, 280, 361, 433].map((y, i) => <line key={y} x1="60" x2="940" y1={y} y2={y} style={{ ["--d" as string]: `${i * .07}s` }} />)}
          </g>
          <g mask="url(#loader-mask-y)" className={styles.vLines}>
            {[290, 307, 437, 567, 633, 710].map((x, i) => <line key={x} x1={x} x2={x} y1="-120" y2="720" style={{ ["--d" as string]: `${.12 + i * .06}s` }} />)}
          </g>
        </g>

        {/* The fill sweeps round the body with progress; the screen stays a window onto the sheet. */}
        <g clipPath="url(#loader-body)">
          <path ref={wedge} className={styles.fill} d="" />
        </g>
        <rect className={styles.screenHole} x="307" y="199" width="260" height="162" rx="10" />

        {/* Each part is first drawn as a solid pen stroke along its path, then settles into the
            dashed blueprint line (the stroke fades as the dashes come in). */}
        {[
          <rect key="body" x="290" y="167" width="420" height="266" rx="34" pathLength={1} />,
          <rect key="screen" x="307" y="199" width="260" height="162" rx="10" pathLength={1} />,
          <circle key="knob" cx="633" cy="247" r="41" pathLength={1} />,
          <circle key="button" cx="633" cy="364" r="31" pathLength={1} />,
          <line key="notch" x1="633" y1="212" x2="633" y2="232" pathLength={1} />,
        ].map((shape, i) => {
          const d = [.45, .85, 1.1, 1.25, 1.35][i];
          return (
            <g key={shape.key} style={{ ["--d" as string]: `${d}s` }}>
              <g className={styles.ink}>{shape}</g>
              <g className={styles.outlines}>{cloneElement(shape, { pathLength: undefined })}</g>
            </g>
          );
        })}

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
