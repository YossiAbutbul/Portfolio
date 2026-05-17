"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./HeroTerminal.module.css";

type Kind = "prompt" | "cmd" | "ok" | "comment" | "kw" | "num" | "str" | "path" | "warn";
type Tok = { text: string; kind?: Kind };

const SCRIPT: Tok[][] = [
  [{ text: "$ ", kind: "prompt" }, { text: "npm install ", kind: "cmd" }, { text: "yossi-abutbul", kind: "kw" }],
  [{ text: "npm http fetch GET ", kind: "comment" }, { text: "200", kind: "num" }, { text: " github.com/YossiAbutbul", kind: "path" }],
  [{ text: "added yossi-abutbul@" }, { text: "2026.01", kind: "num" }],
  [],
  [{ text: "resolving projects...", kind: "comment" }],
  [{ text: "  ✓ ", kind: "ok" }, { text: "rf-instrument-wrappers     ", kind: "kw" }, { text: "Python · FastAPI · Smith chart", kind: "comment" }],
  [{ text: "  ✓ ", kind: "ok" }, { text: "report-generator           ", kind: "kw" }, { text: "React · FastAPI · Plotly · Three.js", kind: "comment" }],
  [{ text: "  ✓ ", kind: "ok" }, { text: "graphviewer                ", kind: "kw" }, { text: "JavaScript · Plotly", kind: "comment" }],
  [{ text: "  ✓ ", kind: "ok" }, { text: "haparlamentor              ", kind: "kw" }, { text: "Next.js · TS · Tailwind · Fuse.js", kind: "comment" }],
  [{ text: "  ✓ ", kind: "ok" }, { text: "lora-viz                   ", kind: "kw" }, { text: "JavaScript · Charting · Log parser", kind: "comment" }],
  [{ text: "  ✓ ", kind: "ok" }, { text: "pipeline-cpu               ", kind: "kw" }, { text: "React · TypeScript · Vite", kind: "comment" }],
  [{ text: "  ✓ ", kind: "ok" }, { text: "two-pass-assembler         ", kind: "kw" }, { text: "ANSI C90 · Make · GDB", kind: "comment" }],
  [{ text: "  ✓ ", kind: "ok" }, { text: "oplanner                   ", kind: "kw" }, { text: "React · TS · Firebase", kind: "comment" }],
  [{ text: "  ✓ ", kind: "ok" }, { text: "attenuator-wrapper         ", kind: "kw" }, { text: "Python · .NET interop", kind: "comment" }],
  [{ text: "  ✓ ", kind: "ok" }, { text: "dmx-motor                  ", kind: "kw" }, { text: "Python · Serial / USB", kind: "comment" }],
  [{ text: "  ✓ ", kind: "ok" }, { text: "mini-circuits-power-sensor ", kind: "kw" }, { text: "Python · USB · .NET", kind: "comment" }],
  [],
  [{ text: "resolving skills...", kind: "comment" }],
  [{ text: "  languages    ", kind: "kw" }, { text: "TypeScript · JavaScript · Python · C", kind: "str" }],
  [{ text: "  frontend     ", kind: "kw" }, { text: "React · Next.js · Vite · Plotly · Three.js · Tailwind", kind: "str" }],
  [{ text: "  backend      ", kind: "kw" }, { text: "FastAPI · REST · Firebase · Firestore · n8n", kind: "str" }],
  [{ text: "  systems      ", kind: "kw" }, { text: "xv6 · RISC-V · Make · GDB · ANSI C90", kind: "str" }],
  [{ text: "  tools        ", kind: "kw" }, { text: "Git · GH Actions · Claude Code · .NET interop", kind: "str" }],
  [{ text: "  rf           ", kind: "kw" }, { text: "Spectrum analyzer · Power sensor · FEM", kind: "str" }],
  [{ text: "  protocols    ", kind: "kw" }, { text: "Bluetooth · LoRa · LTE · NB-IoT · CAT-M", kind: "str" }],
  [],
  [{ text: "added ", kind: "comment" }, { text: "11", kind: "num" }, { text: " projects · ", kind: "comment" }, { text: "0", kind: "num" }, { text: " vulnerabilities", kind: "comment" }],
  [{ text: "  ✓ ", kind: "ok" }, { text: "ready in ", kind: "comment" }, { text: "312ms", kind: "num" }],
  [],
  [{ text: "$ ", kind: "prompt" }],
];

const CHAR_MS = 14;
const LINE_PAUSE_MS = 140;
const RESET_PAUSE_MS = 5000;
const START_DELAY_MS = 400;

function lineLen(line: Tok[]): number {
  let n = 0;
  for (const t of line) n += t.text.length;
  return n;
}

interface Schedule {
  end: number[];
  start: number[];
  total: number;
}

function buildSchedule(): Schedule {
  const start: number[] = [];
  const end: number[] = [];
  let t = START_DELAY_MS;
  for (let i = 0; i < SCRIPT.length; i++) {
    start.push(t);
    const n = lineLen(SCRIPT[i]);
    t += n * CHAR_MS;
    end.push(t);
    t += LINE_PAUSE_MS;
  }
  return { start, end, total: t + RESET_PAUSE_MS };
}

export default function HeroTerminal() {
  const sched = useMemo(buildSchedule, []);
  const [snap, setSnap] = useState({ lineIdx: 0, charIdx: 0 });
  const bodyRef = useRef<HTMLPreElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setSnap({ lineIdx: SCRIPT.length, charIdx: 0 });
      return;
    }

    let raf = 0;
    let cancelled = false;
    const t0 = performance.now();

    function tick(now: number) {
      if (cancelled) return;
      const elapsed = (now - t0) % sched.total;

      let lineIdx = SCRIPT.length;
      let charIdx = 0;
      for (let i = 0; i < SCRIPT.length; i++) {
        if (elapsed < sched.start[i]) {
          lineIdx = i;
          charIdx = 0;
          break;
        }
        if (elapsed < sched.end[i]) {
          lineIdx = i;
          const into = elapsed - sched.start[i];
          charIdx = Math.min(lineLen(SCRIPT[i]), Math.floor(into / CHAR_MS));
          break;
        }
        if (i === SCRIPT.length - 1) {
          lineIdx = SCRIPT.length;
          charIdx = 0;
        }
      }

      setSnap((prev) =>
        prev.lineIdx === lineIdx && prev.charIdx === charIdx ? prev : { lineIdx, charIdx },
      );

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [sched]);

  // Keep the active line in view inside the scrollable body.
  useEffect(() => {
    const body = bodyRef.current;
    const active = activeRef.current;
    if (!body || !active) return;
    const aBottom = active.offsetTop + active.offsetHeight;
    const visibleBottom = body.scrollTop + body.clientHeight;
    // Snap when active line scrolls past visible bottom, OR when typing has
    // looped back to the top.
    if (aBottom > visibleBottom - 8) {
      body.scrollTop = aBottom - body.clientHeight + 8;
    } else if (active.offsetTop < body.scrollTop) {
      body.scrollTop = Math.max(0, active.offsetTop - 8);
    }
  }, [snap.lineIdx]);

  function renderLine(line: Tok[], take: number) {
    if (take >= lineLen(line)) {
      return (
        <>
          {line.map((t, i) => (
            <span key={i} className={t.kind ? styles[t.kind] : undefined}>
              {t.text}
            </span>
          ))}
        </>
      );
    }
    let remaining = take;
    const out: React.ReactNode[] = [];
    for (let i = 0; i < line.length; i++) {
      const t = line[i];
      if (remaining <= 0) break;
      const slice = t.text.slice(0, remaining);
      out.push(
        <span key={i} className={t.kind ? styles[t.kind] : undefined}>
          {slice}
        </span>,
      );
      remaining -= t.text.length;
    }
    return <>{out}</>;
  }

  return (
    <div className={styles.terminal} aria-hidden="true">
      <header className={styles.head}>
        <span className={styles.dotR} />
        <span className={styles.dotY} />
        <span className={styles.dotG} />
        <span className={styles.title}>~/portfolio — yossi</span>
      </header>

      <pre className={styles.body} ref={bodyRef}>
        {SCRIPT.slice(0, Math.min(SCRIPT.length, snap.lineIdx + 1)).map((line, i) => {
          if (i < snap.lineIdx) {
            return (
              <div key={i} className={styles.line}>
                {line.length === 0 ? " " : renderLine(line, lineLen(line))}
              </div>
            );
          }
          return (
            <div key={i} className={styles.line} ref={activeRef}>
              {renderLine(line, snap.charIdx)}
              <span className={styles.caret}>▍</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
