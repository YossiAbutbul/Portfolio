"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./About.module.css";

interface Props {
  /** Final count once the intro ramp finishes. Live tick begins from here. */
  base: number;
  /** Live tick rate (added per second) after intro completes. */
  ratePerSecond?: number;
  /** Duration of the intro ramp from 0 → base, in ms. */
  introMs?: number;
  unit?: string;
  label: string;
}

export default function LiveCountStat({
  base,
  ratePerSecond = 1,
  introMs = 1600,
  unit,
  label,
}: Props) {
  const ref = useRef<HTMLLIElement>(null);
  const [n, setN] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;

    function loop(now: number, t0: number) {
      const elapsed = now - t0;
      if (elapsed < introMs) {
        // Phase 1 — ramp 0 → base, ease-out-cubic
        const p = elapsed / introMs;
        const eased = 1 - Math.pow(1 - p, 3);
        setN(Math.floor(base * eased));
      } else {
        // Phase 2 — live tick from base
        const liveSec = (elapsed - introMs) / 1000;
        setN(base + Math.floor(liveSec * ratePerSecond));
      }
      raf = requestAnimationFrame((next) => loop(next, t0));
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            if (reduce) {
              setN(base);
            } else {
              const t0 = performance.now();
              raf = requestAnimationFrame((now) => loop(now, t0));
            }
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [base, ratePerSecond, introMs]);

  return (
    <li ref={ref} className={styles.stat}>
      <span className={styles.statNum}>
        {n.toLocaleString()}
        {unit && <span className={styles.statUnit}>{unit}</span>}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </li>
  );
}
