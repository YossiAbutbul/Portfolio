"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PROJECTS } from "@content/projects";
import styles from "./SpectrumHero.module.css";

const F_MIN = 10;        // MHz
const F_MAX = 10_000;    // 10 GHz
const DB_MIN = -90;
const DB_MAX = -10;

// SVG coordinate system.
const VB_W = 1200;
const VB_H = 420;
const PAD = { left: 56, right: 56, top: 24, bottom: 40 };

const PLOT_W = VB_W - PAD.left - PAD.right;
const PLOT_H = VB_H - PAD.top - PAD.bottom;

function fToX(freq: number): number {
  const t = (Math.log10(freq) - Math.log10(F_MIN)) / (Math.log10(F_MAX) - Math.log10(F_MIN));
  return PAD.left + Math.max(0, Math.min(1, t)) * PLOT_W;
}

function dbToY(db: number): number {
  const t = (db - DB_MIN) / (DB_MAX - DB_MIN);
  return PAD.top + (1 - Math.max(0, Math.min(1, t))) * PLOT_H;
}

function xToF(x: number): number {
  const t = (x - PAD.left) / PLOT_W;
  const c = Math.max(0, Math.min(1, t));
  return Math.pow(10, Math.log10(F_MIN) + c * (Math.log10(F_MAX) - Math.log10(F_MIN)));
}

function formatFreq(mhz: number): string {
  if (mhz >= 1000) return `${(mhz / 1000).toFixed(mhz % 1000 === 0 ? 0 : 2)} GHz`;
  if (mhz >= 1) return `${mhz.toFixed(mhz < 100 ? 1 : 0)} MHz`;
  return `${(mhz * 1000).toFixed(0)} kHz`;
}

// Gaussian-like peak contribution in dB at frequency f for a project at fp with amplitude a.
function peakContribution(fLog: number, fpLog: number, amp: number): number {
  const sigma = 0.06; // width in log10(MHz) units
  const d = fLog - fpLog;
  return amp * Math.exp(-(d * d) / (2 * sigma * sigma));
}

interface Sample {
  x: number;
  y: number;
}

const SAMPLES = 360; // resolution of the trace

export default function SpectrumHero() {
  const containerRef = useRef<SVGSVGElement>(null);
  const [tick, setTick] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [markerFreq, setMarkerFreq] = useState<number>(2450);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Sort projects by frequency for marker assignment.
  const peaks = useMemo(
    () => [...PROJECTS].sort((a, b) => a.frequency - b.frequency),
    [],
  );

  // Animation loop: ~12 fps noise update is enough (live-instrument feel).
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setTick((t) => t + 1), 220);
    return () => clearInterval(id);
  }, []);

  // Compute trace samples (deterministic peaks + animated noise floor).
  // Skip on SSR pass — Node and V8 transcendentals (sin/cos) diverge by a few ulp,
  // which triggers hydration mismatch on the SVG path string.
  const trace: Sample[] = useMemo(() => {
    if (!mounted) return [];
    const out: Sample[] = [];
    const logMin = Math.log10(F_MIN);
    const logMax = Math.log10(F_MAX);
    for (let i = 0; i < SAMPLES; i++) {
      const t = i / (SAMPLES - 1);
      const fLog = logMin + t * (logMax - logMin);
      const f = Math.pow(10, fLog);
      // Deterministic pseudo-random noise floor (~ -85 +/- 4 dB). No Math.random — SSR-stable.
      const seed = i * 0.37 + tick * 0.13;
      const noise = -85
        + Math.sin(seed * 2.7) * 1.5
        + Math.cos(seed * 1.3 + 0.5) * 2
        + Math.sin(seed * 9.41 + i * 0.97) * 1.8;
      let db = noise;
      // Peak contributions
      for (const p of peaks) {
        const fpLog = Math.log10(p.frequency);
        db = Math.max(db, noise + peakContribution(fLog, fpLog, p.amplitude * 8));
      }
      out.push({ x: fToX(f), y: dbToY(db) });
    }
    return out;
  }, [peaks, tick, mounted]);

  const tracePath = useMemo(() => {
    if (trace.length === 0) return "";
    let d = `M ${trace[0].x} ${trace[0].y}`;
    for (let i = 1; i < trace.length; i++) d += ` L ${trace[i].x} ${trace[i].y}`;
    return d;
  }, [trace]);

  const traceFillPath = useMemo(() => {
    if (trace.length === 0) return "";
    let d = `M ${trace[0].x} ${dbToY(DB_MIN)}`;
    for (const s of trace) d += ` L ${s.x} ${s.y}`;
    d += ` L ${trace[trace.length - 1].x} ${dbToY(DB_MIN)} Z`;
    return d;
  }, [trace]);

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = containerRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const loc = pt.matrixTransform(ctm.inverse());
    const x = Math.max(PAD.left, Math.min(VB_W - PAD.right, loc.x));
    setMarkerFreq(xToF(x));

    // Snap-detect nearest peak (in log freq).
    const targetLog = Math.log10(xToF(x));
    let nearest: { slug: string; d: number } | null = null;
    for (const p of peaks) {
      const d = Math.abs(Math.log10(p.frequency) - targetLog);
      if (!nearest || d < nearest.d) nearest = { slug: p.slug, d };
    }
    setHovered(nearest && nearest.d < 0.08 ? nearest.slug : null);
  }

  function handleLeave() {
    setHovered(null);
  }

  const dbGrid = [-10, -30, -50, -70, -90];
  const fGrid = [10, 30, 100, 300, 1000, 3000, 10_000];

  const markerX = fToX(markerFreq);
  const hoveredProject = hovered ? peaks.find((p) => p.slug === hovered) : null;

  return (
    <section className={styles.hero} aria-labelledby="hero-name">
      <div className={`container ${styles.inner}`}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>
            <span className={styles.dot} aria-hidden="true" />
            <span>spectrum_view</span>
            <span className={styles.sep} aria-hidden="true">/</span>
            <span>portfolio_v2</span>
          </p>
          <h1 id="hero-name" className={styles.title}>
            Yossi <span className={styles.titleAccent}>Abutbul</span>
          </h1>
          <p className={styles.subtitle}>
            Software where <span className={styles.under}>signals</span> meet <span className={styles.under}>code</span>.
          </p>
          <p className={styles.meta}>
            <span>BSc CS · Open University</span>
            <span className={styles.metaSep} aria-hidden="true">·</span>
            <span>RF integrator · 5+ years</span>
            <span className={styles.metaSep} aria-hidden="true">·</span>
            <span>Arad Technologies</span>
          </p>
        </header>

        <div className={styles.instrument}>
          <header className={styles.instrumentHead}>
            <span className={styles.lcdRow}>
              <span className={styles.lcdKey}>SPAN</span>
              <span className={styles.lcdVal}>10 MHz &mdash; 10 GHz</span>
            </span>
            <span className={styles.lcdRow}>
              <span className={styles.lcdKey}>RBW</span>
              <span className={styles.lcdVal}>100 kHz</span>
            </span>
            <span className={styles.lcdRow}>
              <span className={styles.lcdKey}>REF</span>
              <span className={styles.lcdVal}>-10 dBm</span>
            </span>
            <span className={styles.lcdRow}>
              <span className={styles.lcdKey}>SWP</span>
              <span className={styles.lcdValLive}>LIVE</span>
            </span>
          </header>

          <svg
            ref={containerRef}
            className={styles.svg}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            onPointerMove={handleMove}
            onPointerLeave={handleLeave}
            role="img"
            aria-label="Live spectrum showing portfolio projects as peaks across the RF band"
          >
            {/* Grid */}
            {dbGrid.map((db) => (
              <g key={db}>
                <line
                  x1={PAD.left}
                  x2={VB_W - PAD.right}
                  y1={dbToY(db)}
                  y2={dbToY(db)}
                  className={styles.gridH}
                />
                <text x={PAD.left - 10} y={dbToY(db) + 4} className={styles.axisLabel} textAnchor="end">
                  {db}
                </text>
              </g>
            ))}
            {fGrid.map((f) => (
              <g key={f}>
                <line
                  x1={fToX(f)}
                  x2={fToX(f)}
                  y1={PAD.top}
                  y2={VB_H - PAD.bottom}
                  className={styles.gridV}
                />
                <text x={fToX(f)} y={VB_H - PAD.bottom + 18} className={styles.axisLabel} textAnchor="middle">
                  {formatFreq(f)}
                </text>
              </g>
            ))}

            {/* Trace fill + line */}
            <path d={traceFillPath} className={styles.traceFill} />
            <path d={tracePath} className={styles.trace} />

            {/* Peaks with marker labels */}
            {peaks.map((p, i) => {
              const px = fToX(p.frequency);
              const py = dbToY(-85 + p.amplitude * 8);
              const isOn = hovered === p.slug;
              const markerLabel = `M${(i + 1).toString().padStart(2, "0")}`;
              return (
                <g key={p.slug} className={`${styles.peak} ${isOn ? styles.peakOn : ""}`}>
                  <line x1={px} x2={px} y1={py} y2={dbToY(-90)} className={styles.peakStem} />
                  <circle cx={px} cy={py} r={isOn ? 5 : 3} className={styles.peakDot} />
                  <text x={px} y={py - 10} textAnchor="middle" className={styles.peakLabel}>
                    {markerLabel}
                  </text>
                </g>
              );
            })}

            {/* Cursor marker */}
            <g className={styles.cursor}>
              <line x1={markerX} x2={markerX} y1={PAD.top} y2={VB_H - PAD.bottom} className={styles.cursorLine} />
              <rect
                x={markerX + 8}
                y={PAD.top + 6}
                width={120}
                height={36}
                rx={4}
                className={styles.cursorBox}
              />
              <text x={markerX + 16} y={PAD.top + 22} className={styles.cursorTextKey}>
                MKR
              </text>
              <text x={markerX + 50} y={PAD.top + 22} className={styles.cursorTextVal}>
                {formatFreq(markerFreq)}
              </text>
              <text x={markerX + 16} y={PAD.top + 36} className={styles.cursorTextSub}>
                {hoveredProject ? hoveredProject.title : "noise floor"}
              </text>
            </g>
          </svg>

          <footer className={styles.instrumentFoot}>
            <span className={styles.lcdRow}>
              <span className={styles.lcdKey}>PEAKS</span>
              <span className={styles.lcdVal}>{peaks.length} captured</span>
            </span>
            <span className={styles.hint}>hover the trace · click a peak to open the capture</span>
          </footer>

          {/* Click-targets overlaid on peaks (HTML, accessible) */}
          <div className={styles.peakLinks} aria-label="Project peaks">
            {peaks.map((p, i) => {
              const xPct = ((fToX(p.frequency) - PAD.left) / PLOT_W) * 100;
              const href = p.noCase
                ? p.links.find((l) => l.href.startsWith("http"))?.href ?? "#"
                : `/projects/${p.slug}/`;
              const external = p.noCase;
              const markerLabel = `M${(i + 1).toString().padStart(2, "0")}`;
              const Comp: React.ElementType = external ? "a" : Link;
              const cProps = external
                ? { href, target: "_blank", rel: "noreferrer noopener" }
                : { href };
              return (
                <Comp
                  key={p.slug}
                  {...cProps}
                  className={styles.peakLink}
                  style={{ left: `calc(${xPct}% * (100% / 100%))`, "--xpct": `${xPct}%` } as React.CSSProperties}
                  onMouseEnter={() => setHovered(p.slug)}
                  onMouseLeave={() => setHovered(null)}
                  aria-label={`${markerLabel} — ${p.title} at ${formatFreq(p.frequency)}`}
                >
                  <span className={styles.peakLinkLabel}>
                    [{markerLabel}] {p.title}
                  </span>
                </Comp>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
