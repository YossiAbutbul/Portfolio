"use client";

import { cloneElement, useEffect, useRef, useState } from "react";
import styles from "./LaunchLoader.module.css";

/** The sheet's shortest time, so the sketch is seen; it then waits for the 3D scene's first frame. */
const LIFT_MS = 1600;
/** On a reload in the same tab. */
const LIFT_SEEN_MS = 1000;
/** The longest it holds the page: a slow or failed scene never keeps the hero's words away. */
const LIFT_MAX_MS = 8000;
let firstMount = true;

/* The 404's outlines, as the 3D sign draws them (desk.ts): a 4 is one outline with a triangular
   counter, the 0 a rounded slot. Units of 162.5 px, 1.6 tall, baseline at y 430. */
const U = 162.5, BASE = 430;
const at = (x0: number, pts: [number, number][]) => pts.map(([u, v]) => `${(x0 + u * U).toFixed(1)},${(BASE - v * U).toFixed(1)}`).join(" ");
const FOUR: [number, number][] = [[.66, 0], [.96, 0], [.96, .38], [1.16, .38], [1.16, .66], [.96, .66], [.96, 1.6], [.64, 1.6], [0, .64], [0, .38], [.66, .38]];
const FOUR_HOLE: [number, number][] = [[.66, .66], [.66, 1.12], [.33, .66]];
const X4A = 204, X0 = 412, X4B = 611;
// A rounded rectangle as path data, for the 0 and its slot inside the fill's clip.
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;

/**
 * A blueprint of the device (or, on the 404 page, of the 404 standing on the desk), drawn on a dark
 * sheet as the page opens: dashed outlines, Bézier handles, construction lines, and a fill that sweeps
 * round with the scene's loading. It lifts once the sketch has been seen and the 3D scene's first
 * frame is ready (LaunchStage reports progress), so the page opens straight onto the live desk;
 * LIFT_MAX_MS caps the wait.
 */
export default function LaunchLoader({ mark = "device" }: { mark?: "device" | "404" }) {
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
    // The hero's entrance and the scene wait for this sheet's lift (coming back from a project page too).
    root.removeAttribute("data-entering");
    // The scene's progress, 0 to 1 (1 once its first frame is up, or when there is no WebGL).
    let scene = 0;
    const onProgress = (e: Event) => { scene = Math.max(scene, (e as CustomEvent<number>).detail); };
    window.addEventListener("launch:progress", onProgress);

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
      // The fill follows the slower of the clock and the scene.
      draw(Math.min(t * t * (3 - 2 * t), .15 + .85 * scene));
      if ((elapsed >= liftMs && scene >= 1) || elapsed >= LIFT_MAX_MS) { draw(1); leave(); return; }
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
      window.removeEventListener("launch:progress", onProgress);
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

  // Each part is first drawn as a solid pen stroke along its path, then settles into the dashed
  // blueprint line (the stroke fades as the dashes come in).
  const parts = (shapes: React.ReactElement[], delays: number[]) => shapes.map((shape, i) => (
    <g key={shape.key} style={{ ["--d" as string]: `${delays[i]}s` }}>
      <g className={styles.ink}>{shape}</g>
      <g className={styles.outlines}>{cloneElement(shape, { pathLength: undefined } as never)}</g>
    </g>
  ));
  const is404 = mark === "404";
  const hLines = is404 ? [170, 323, 368, 430] : [167, 199, 280, 361, 433];
  const vLines = is404 ? [204, 360, 412, 591, 611, 767, 800] : [290, 307, 437, 567, 633, 710];

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
          {is404 ? (
            <clipPath id="loader-body" clipRule="evenodd">
              <path clipRule="evenodd" d={`M${at(X4A, FOUR)}Z M${at(X4A, FOUR_HOLE)}Z M${at(X4B, FOUR)}Z M${at(X4B, FOUR_HOLE)}Z`} />
              <path clipRule="evenodd" d={rr(X0, 170, 1.1 * U, 1.6 * U, .52 * U) + rr(X0 + .3 * U, BASE - 1.3 * U, .5 * U, U, .25 * U)} />
            </clipPath>
          ) : (
            <clipPath id="loader-body"><rect x="290" y="167" width="420" height="266" rx="34" /></clipPath>
          )}
        </defs>

        <g className={styles.construction}>
          {/* Ruled in one after another, each from its starting end, like a pen across the sheet. */}
          <g mask="url(#loader-mask-x)" className={styles.hLines}>
            {hLines.map((y, i) => <line key={y} x1="60" x2="940" y1={y} y2={y} style={{ ["--d" as string]: `${i * .07}s` }} />)}
          </g>
          <g mask="url(#loader-mask-y)" className={styles.vLines}>
            {vLines.map((x, i) => <line key={x} x1={x} x2={x} y1="-120" y2="720" style={{ ["--d" as string]: `${.12 + i * .06}s` }} />)}
          </g>
        </g>

        {/* The fill sweeps round with progress, inside the outlines. */}
        <g clipPath="url(#loader-body)">
          <path ref={wedge} className={styles.fill} d="" />
        </g>

        {is404 ? (
          <>
            {parts([
              <polygon key="4a" points={at(X4A, FOUR)} pathLength={1} />,
              <rect key="0" x={X0} y={170} width={1.1 * U} height={1.6 * U} rx={.52 * U} pathLength={1} />,
              <polygon key="4b" points={at(X4B, FOUR)} pathLength={1} />,
              <polygon key="4ah" points={at(X4A, FOUR_HOLE)} pathLength={1} />,
              <rect key="0h" x={X0 + .3 * U} y={BASE - 1.3 * U} width={.5 * U} height={U} rx={.25 * U} pathLength={1} />,
              <polygon key="4bh" points={at(X4B, FOUR_HOLE)} pathLength={1} />,
            ], [.45, .7, .95, 1.15, 1.25, 1.35])}
            <g className={styles.handles}>
              {handle(X4A + .64 * U, BASE - 1.6 * U, X4A + .96 * U, BASE - 1.6 * U, true, "a1")}
              {handle(X4A, BASE - .64 * U, X4A, BASE - .38 * U, true, "a2")}
              {handle(X0 + .25 * U, 170, X0 + .85 * U, 170, true, "z1")}
              {handle(X0 + .25 * U, BASE, X0 + .85 * U, BASE, true, "z2")}
              {handle(X0, 230 + 30, X0, 340, true, "z3")}
              {handle(X0 + 1.1 * U, 260, X0 + 1.1 * U, 340, true, "z4")}
              {handle(X4B + .64 * U, BASE - 1.6 * U, X4B + .96 * U, BASE - 1.6 * U, true, "b1")}
              {handle(X4B + .96 * U, BASE - .38 * U, X4B + 1.16 * U, BASE - .38 * U, false, "b2")}
              {handle(X4B + .66 * U, BASE, X4B + .96 * U, BASE, false, "b3")}
            </g>
          </>
        ) : (
          <>
            <rect className={styles.screenHole} x="307" y="199" width="260" height="162" rx="10" />
            {parts([
              <rect key="body" x="290" y="167" width="420" height="266" rx="34" pathLength={1} />,
              <rect key="screen" x="307" y="199" width="260" height="162" rx="10" pathLength={1} />,
              <circle key="knob" cx="633" cy="247" r="41" pathLength={1} />,
              <circle key="button" cx="633" cy="364" r="31" pathLength={1} />,
              <line key="notch" x1="633" y1="212" x2="633" y2="232" pathLength={1} />,
            ], [.45, .85, 1.1, 1.25, 1.35])}
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
          </>
        )}
      </svg>
      <div className={styles.meta}>
        <span>Yossi Abutbul</span>
        <span><span ref={readout}>000</span> / 100</span>
      </div>
    </div>
  );
}
