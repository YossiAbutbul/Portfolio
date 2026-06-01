"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./InlineWaves.module.css";

const VB_W = 120;
const VB_H = 40;
const N = 110;

interface Build {
  /** "in" — amp grows toward right (meets-side); "out" — amp grows toward left. */
  direction: "in" | "out";
  /** Carrier freq cycles across the span. */
  freq: number;
  /** Phase offset. */
  phase: number;
  /** Amplitude scalar in viewbox units. */
  amp: number;
  /** Time-driven scrub. */
  speed: number;
}

function buildPath(t: number, cfg: Build): string {
  let d = "";
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const x = u * VB_W;

    // Bell envelope peaks in middle, tapers to 0 at both ends so the wave
    // collapses onto the center line at both ends — clean connection to the
    // outer word AND to the MEETS pill.
    const bell = Math.sin(u * Math.PI);
    // Slight bias toward the meets-side so the "in" wave reads as entering
    // and the "out" wave as leaving.
    const bias = cfg.direction === "in" ? Math.pow(u, 0.4) : Math.pow(1 - u, 0.4);
    const env = bell * bias;

    const carrier = Math.sin(u * cfg.freq + cfg.phase + t * cfg.speed);
    const am = 0.55 + 0.45 * Math.sin(u * 3.0 - t * 0.5 + cfg.phase * 0.3);

    const y = VB_H / 2 + carrier * am * env * cfg.amp;
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2) + " ";
  }
  return d;
}

function Wave({ direction }: { direction: "in" | "out" }) {
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

  const main: Build = { direction, freq: 28, phase: direction === "in" ? 0.0 : 1.7, amp: VB_H * 0.42, speed: 2.4 };
  const dim:  Build = { direction, freq: 22, phase: direction === "in" ? 1.1 : 0.4, amp: VB_H * 0.30, speed: 1.9 };

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={styles.svg}
      aria-hidden="true"
    >
      <path d={buildPath(t, dim)} className={styles.pathDim} fill="none" />
      <path d={buildPath(t, main)} className={styles.path} fill="none" />
    </svg>
  );
}

export default function InlineWaves() {
  return (
    <span className={styles.wrap}>
      <span className={styles.half}>
        <Wave direction="in" />
      </span>
      <span className={styles.label}>meet</span>
      <span className={styles.half}>
        <Wave direction="out" />
      </span>
    </span>
  );
}
