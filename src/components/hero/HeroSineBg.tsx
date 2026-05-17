"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./HeroSineBg.module.css";

const VB_W = 1200;
const VB_H = 200;
const N = 360;

/** Dead-zone in the centre where the hero copy sits. Wave is fully drawn
 *  outside this range and completely absent inside it — hard cut, no fade. */
const DEAD_START = 0.32;
const DEAD_END = 0.68;

function buildPath(t: number, freq: number, amp: number, phase: number): string {
  let d = "";
  let pendingMove = true;
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    if (u >= DEAD_START && u <= DEAD_END) {
      // Skip the dead zone — emit no segment, force next point to start a new subpath.
      pendingMove = true;
      continue;
    }
    const x = u * VB_W;
    const y = VB_H / 2 + Math.sin(u * Math.PI * freq + phase + t * 0.6) * amp;
    d += (pendingMove ? "M " : "L ") + x.toFixed(2) + " " + y.toFixed(2) + " ";
    pendingMove = false;
  }
  return d;
}

export default function HeroSineBg() {
  const [t, setT] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const start = performance.now();
    function loop(now: number) {
      setT((now - start) / 1000);
      raf.current = requestAnimationFrame(loop);
    }
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return (
    <div className={styles.wrap} aria-hidden="true">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className={styles.svg}>
        {/* Secondary trail */}
        <path d={buildPath(t * 0.7, 4, 40, 1.2)} className={styles.trail} fill="none" />
        {/* Primary sine */}
        <path d={buildPath(t, 3, 60, 0)} className={styles.wave} fill="none" />
      </svg>
    </div>
  );
}
