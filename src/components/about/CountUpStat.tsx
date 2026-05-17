"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./About.module.css";

interface Props {
  value: number;
  unit?: string;
  label: string;
  duration?: number;
}

export default function CountUpStat({ value, unit, label, duration = 1400 }: Props) {
  const ref = useRef<HTMLLIElement>(null);
  const [n, setN] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setN(value);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            const start = performance.now();
            const ease = (t: number) => 1 - Math.pow(1 - t, 3); // ease-out-cubic
            let raf = 0;
            function step(now: number) {
              const p = Math.min(1, (now - start) / duration);
              setN(Math.round(value * ease(p)));
              if (p < 1) raf = requestAnimationFrame(step);
            }
            raf = requestAnimationFrame(step);
            io.disconnect();
            return () => cancelAnimationFrame(raf);
          }
        }
      },
      { threshold: 0.4 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <li ref={ref} className={styles.stat}>
      <span className={styles.statNum}>
        {n}
        {unit && <span className={styles.statUnit}>{unit}</span>}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </li>
  );
}
