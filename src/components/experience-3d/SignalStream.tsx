"use client";

import { useEffect, useState } from "react";
import type { Chapter } from "./chapters";
import styles from "./SignalStream.module.css";

const VB_W = 320;
const VB_H = 320;

function shapePath(waveform: Chapter["signal"]["waveform"], t: number): string {
  const N = 240;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * VB_W;
    const u = i / (N - 1);
    let y = VB_H / 2;
    const amp = 70;
    const phase = t * 1.4;
    switch (waveform) {
      case "sine":
        y = VB_H / 2 + Math.sin(u * Math.PI * 6 + phase) * amp;
        break;
      case "square":
        y = VB_H / 2 + (Math.sin(u * Math.PI * 6 + phase) > 0 ? -amp : amp);
        break;
      case "pulse": {
        const period = 1 / 6;
        const local = ((u * 6 + (phase / (Math.PI * 2))) % 1 + 1) % 1;
        y = VB_H / 2 + (local < 0.12 ? -amp : amp * 0.05);
        void period;
        break;
      }
      case "burst":
        y = VB_H / 2 + Math.sin(u * Math.PI * 24 + phase) * amp * Math.exp(-Math.pow((u - 0.5) * 4, 2));
        break;
      case "noise":
      default:
        y = VB_H / 2 + (Math.sin(u * 90 + phase) + Math.cos(u * 41.7 + phase * 1.3)) * amp * 0.5;
    }
    pts.push([x, y]);
  }
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
}

export default function SignalStream({ chapter }: { chapter: Chapter }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    const start = performance.now();
    function loop(now: number) {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const d = shapePath(chapter.signal.waveform, t);
  const grid = [0.25, 0.5, 0.75];

  return (
    <aside className={styles.lane} aria-label="Signal lane">
      <header className={styles.head}>
        <span className={styles.live}>● LIVE</span>
        <span className={styles.label}>{chapter.signal.label}</span>
        <span className={styles.freq}>
          {chapter.signal.freqMHz >= 1000
            ? `${(chapter.signal.freqMHz / 1000).toFixed(2)} GHz`
            : chapter.signal.freqMHz >= 1
            ? `${chapter.signal.freqMHz} MHz`
            : `${(chapter.signal.freqMHz * 1000).toFixed(1)} kHz`}
        </span>
      </header>

      <div className={styles.scope}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className={styles.svg}>
          {grid.map((p) => (
            <line
              key={`h${p}`}
              x1={0}
              x2={VB_W}
              y1={p * VB_H}
              y2={p * VB_H}
              className={styles.grid}
            />
          ))}
          {grid.map((p) => (
            <line
              key={`v${p}`}
              x1={p * VB_W}
              x2={p * VB_W}
              y1={0}
              y2={VB_H}
              className={styles.grid}
            />
          ))}
          <line x1={0} x2={VB_W} y1={VB_H / 2} y2={VB_H / 2} className={styles.zero} />
          <path d={d} className={styles.trace} />
        </svg>
      </div>

      <footer className={styles.foot}>
        <span>WF</span>
        <span className={styles.wfVal}>{chapter.signal.waveform.toUpperCase()}</span>
        <span className={styles.spacer} />
        <span>VDIV</span>
        <span className={styles.wfVal}>200 mV</span>
      </footer>
    </aside>
  );
}
