"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./HeroWaveField.module.css";

const VB_W = 320;
const VB_H = 360;
const N = 240;

interface Trace {
  yOff: number;       // baseline y inside viewbox
  freq: number;       // carrier freq
  amp: number;        // peak amplitude (viewbox units)
  speed: number;      // travelling-packet speed
  phase: number;
  primary: boolean;
}

const TRACES: Trace[] = [
  { yOff: VB_H * 0.10, freq: 0.18, amp: 22, speed: 0.55, phase: 0.0, primary: false },
  { yOff: VB_H * 0.22, freq: 0.22, amp: 30, speed: 0.45, phase: 0.7, primary: false },
  { yOff: VB_H * 0.34, freq: 0.16, amp: 42, speed: 0.40, phase: 1.4, primary: false },
  { yOff: VB_H * 0.46, freq: 0.24, amp: 52, speed: 0.55, phase: 2.1, primary: true  },
  { yOff: VB_H * 0.58, freq: 0.16, amp: 42, speed: 0.42, phase: 0.5, primary: false },
  { yOff: VB_H * 0.70, freq: 0.20, amp: 30, speed: 0.50, phase: 1.9, primary: false },
  { yOff: VB_H * 0.82, freq: 0.18, amp: 22, speed: 0.46, phase: 2.6, primary: false },
];

function buildPath(t: number, c: Trace): string {
  let d = "";
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);                              // 0 → 1
    const x = u * VB_W;
    // Emanation ramp — amp = 0 at left edge (text origin), grows outward.
    const ramp = Math.min(1, Math.max(0, (u - 0.04) / 0.20));
    // Travelling Gaussian wavepacket — gives the "wave leaving the text" feel.
    const u0 = ((t * c.speed * 0.18) % 1.6) - 0.3;
    const packet = Math.exp(-Math.pow((u - u0) * 2.6, 2));
    // Slow AM envelope.
    const am = 0.55 + 0.45 * Math.sin(u * 4.2 - t * 0.4 + c.phase * 0.3);
    // RF carrier.
    const carrier = Math.sin(u * c.freq * VB_W + c.phase - t * c.speed * 1.4);
    // Fade at far right so traces dissipate, not clip the edge.
    const tail = 1 - Math.pow(Math.max(0, u - 0.85) / 0.15, 2);

    const y = c.yOff + (carrier * am + packet * 0.35) * ramp * tail * c.amp;
    d += (i === 0 ? "M " : "L ") + x.toFixed(2) + " " + y.toFixed(2) + " ";
  }
  return d;
}

export default function HeroWaveField() {
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
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className={styles.svg}
      >
        {TRACES.map((c, i) => (
          <path
            key={i}
            d={buildPath(t, c)}
            fill="none"
            className={c.primary ? styles.primary : styles.secondary}
          />
        ))}
      </svg>
    </div>
  );
}
