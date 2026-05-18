"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./HeroSineBg.module.css";

const VB_W = 1200;
const VB_H = 200;
const N = 360;

function buildPath(t: number, freq: number, amp: number, phase: number): string {
  let d = "";
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const x = u * VB_W;
    const y = VB_H / 2 + Math.sin(u * Math.PI * freq + phase + t * 0.6) * amp;
    d += (i === 0 ? "M " : "L ") + x.toFixed(2) + " " + y.toFixed(2) + " ";
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
        {/* Deep slow swell */}
        <path d={buildPath(t * 0.35, 2, 140, 2.5)} className={styles.swell} fill="none" />
        {/* Dim mid trail */}
        <path d={buildPath(t * 0.55, 4, 75, 1.2)} className={styles.trail} fill="none" />
        {/* Fast shallow ripple */}
        <path d={buildPath(t * 1.4, 6, 42, 0.8)} className={styles.ripple} fill="none" />
        {/* Primary sine */}
        <path d={buildPath(t, 3, 100, 0)} className={styles.wave} fill="none" />
      </svg>
    </div>
  );
}
