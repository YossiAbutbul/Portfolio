"use client";

import { useEffect, useRef } from "react";
import styles from "./FloorNoise.module.css";

const VB_W = 1200;
const VB_H = 64;
const MID  = VB_H / 2;
const N    = 700; // dense — high-freq aliasing creates noise appearance

// [freq, amp, speed, phase]
const COMPS: [number, number, number, number][] = [
  [19,   5, 1.2, 0.0],
  [47,   6, 3.6, 1.1],
  [83,   5, 6.9, 2.2],
  [131,  4, 9.3, 0.5],
  [179,  4, 5.4, 1.7],
  [233,  4, 12.6, 3.1],
  [281,  3, 8.7, 0.8],
  [347,  3, 15.3, 2.0],
  [401,  3, 11.1, 1.3],
  [461,  2, 18.9, 0.2],
  [523,  2, 14.4, 2.8],
  [601,  2, 21.6, 1.5],
  [31,   4, 1.2, 2.1],
];

function buildPath(t: number): string {
  let d = "";
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const x = u * VB_W;
    let y = MID;
    for (const [freq, amp, speed, phase] of COMPS) {
      y += Math.sin(u * freq + t * speed + phase) * amp;
    }
    // Clamp so wave never exits the viewBox
    y = Math.max(1, Math.min(VB_H - 1, y));
    d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
  }
  return d;
}

export default function FloorNoise() {
  const pathRef  = useRef<SVGPathElement>(null);
  const raf      = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();

    function loop(now: number) {
      const t = (now - start) / 1000;
      pathRef.current?.setAttribute("d", buildPath(t));
      raf.current = requestAnimationFrame(loop);
    }
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return (
    <div className={styles.wrap} aria-hidden="true">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className={styles.svg}
      >
        <path ref={pathRef} className={styles.noise} fill="none" />
      </svg>
    </div>
  );
}
