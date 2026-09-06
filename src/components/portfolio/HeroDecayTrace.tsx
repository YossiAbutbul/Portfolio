"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import { formatClock, generateRun, levelForDb, type Capture, type DecayRun } from "@/lib/decayRun";
import styles from "./HeroDecayTrace.module.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * Hero trace: one TX current-decay run, drawn as the logger would draw it.
 *
 * Every burst the device transmitted is a tick at its real spacing; the line
 * riding their peaks is the envelope; the dashed rule is the stop threshold.
 * The run acquires itself on load, then the rest of it acquires as the page
 * scrolls, so leaving the hero and the cell reaching end of life are the same
 * gesture.
 *
 * The pointer is a marker, not a disturbance - it reads the capture under the
 * cursor rather than deforming it. Measurement data that wobbles when you look
 * at it is decoration pretending to be data.
 */

const MAX_DPR = 2;
/** Fraction of the run acquired by the load animation, before scroll takes over. */
const INTRO_SHARE = 0.55;
/** Captures still glowing at full strength behind the acquisition edge. */
const PERSISTENCE = 16;
/** Horizontal grid rule every six hours of run time. */
const GRID_TIME_S = 6 * 3600;
/** Horizontal grid rule every 50 mA. */
const GRID_LEVEL_MA = 50;

type Palette = {
  accent: string;
  dim: string;
  hairline: string;
};

/** `#rgb` / `#rrggbb` to `rgba()`. Anything else passes through unchanged. */
function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (!hex.startsWith("#")) return hex;
  const body = hex.slice(1);
  const full = body.length === 3 ? body.split("").map((c) => c + c).join("") : body;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return hex;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function readPalette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  return {
    accent: style.getPropertyValue("--accent").trim() || "#55f2a4",
    dim: style.getPropertyValue("--fg-dim").trim() || "#425563",
    hairline: style.getPropertyValue("--hairline").trim() || "rgba(191,189,182,0.07)",
  };
}

/** Plot geometry, in CSS pixels. The trace bleeds edge to edge. */
function plotBox(width: number, height: number) {
  const top = height * 0.5;
  const bottom = height - Math.min(96, height * 0.16);
  return { top, bottom, height: bottom - top, width };
}

export default function HeroDecayTrace() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<DecayRun>(generateRun());
  /** 0 to 1: how much of the run has been acquired and is on screen. */
  const introRef = useRef(0);
  const scrollRef = useRef(0);
  const markerRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const paletteRef = useRef<Palette>({ accent: "#55f2a4", dim: "#425563", hairline: "rgba(191,189,182,0.07)" });

  const [marker, setMarker] = useState<{ capture: Capture; x: number } | null>(null);

  const run = runRef.current;
  const thresholdMa = levelForDb(run, run.thresholdDb);

  // -------------------------------------------------------------------------
  // Draw. Everything is redrawn from the run each frame; there is no retained
  // scene, which keeps acquisition, resize and theme changes one code path.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 0;
    let height = 0;

    function resize() {
      const rect = host!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
      paletteRef.current = readPalette(host!);
    }

    function draw() {
      frameRef.current = 0;
      if (width === 0 || height === 0) return;

      const { accent, dim, hairline } = paletteRef.current;
      const box = plotBox(width, height);
      const maxMa = run.refMa * 1.14;
      const acquired = Math.min(1, introRef.current * INTRO_SHARE + (1 - INTRO_SHARE) * scrollRef.current);
      const edge = acquired * (run.captures.length - 1);

      const x = (t: number) => (t / run.durationS) * box.width;
      const y = (ma: number) => box.bottom - (ma / maxMa) * box.height;

      // The HTML labels sit on the same geometry as the canvas, so publish it
      // rather than duplicating the maths in CSS.
      host!.style.setProperty("--plot-top", `${box.top}px`);
      host!.style.setProperty("--plot-bottom", `${box.bottom}px`);
      host!.style.setProperty("--threshold-y", `${y(thresholdMa)}px`);

      context!.clearRect(0, 0, width, height);

      // Graticule ------------------------------------------------------------
      context!.lineWidth = 1;
      context!.strokeStyle = hairline;
      context!.beginPath();
      for (let ma = GRID_LEVEL_MA; ma < maxMa; ma += GRID_LEVEL_MA) {
        const gy = Math.round(y(ma)) + 0.5;
        context!.moveTo(0, gy);
        context!.lineTo(box.width, gy);
      }
      for (let t = 0; t <= run.durationS; t += GRID_TIME_S) {
        const gx = Math.round(x(t)) + 0.5;
        context!.moveTo(gx, box.top);
        context!.lineTo(gx, box.bottom);
      }
      context!.stroke();

      // Baseline: the sleep current the unit sits at between bursts.
      const baseY = Math.round(y(run.floorMa)) + 0.5;
      context!.strokeStyle = withAlpha(dim, 0.55);
      context!.beginPath();
      context!.moveTo(0, baseY);
      context!.lineTo(box.width, baseY);
      context!.stroke();

      // Stop threshold --------------------------------------------------------
      const thresholdY = Math.round(y(thresholdMa)) + 0.5;
      context!.save();
      context!.setLineDash([2, 5]);
      context!.strokeStyle = withAlpha(dim, 0.9);
      context!.beginPath();
      context!.moveTo(0, thresholdY);
      context!.lineTo(box.width, thresholdY);
      context!.stroke();
      context!.restore();

      // Bursts ----------------------------------------------------------------
      // Older captures sit back; the last few behind the acquisition edge stay
      // lit, the way a scope holds recent traces.
      context!.lineWidth = 1;
      for (const capture of run.captures) {
        if (capture.index > edge) break;
        const age = edge - capture.index;
        const alpha = age > PERSISTENCE ? 0.2 : 0.2 + 0.62 * (1 - age / PERSISTENCE);
        const bx = Math.round(x(capture.t)) + 0.5;
        context!.strokeStyle = withAlpha(accent, alpha);
        context!.beginPath();
        context!.moveTo(bx, baseY);
        context!.lineTo(bx, y(capture.peakMa));
        context!.stroke();
      }

      // Envelope --------------------------------------------------------------
      context!.lineWidth = 1.4;
      context!.strokeStyle = accent;
      context!.lineJoin = "round";
      context!.beginPath();
      let started = false;
      for (const capture of run.captures) {
        if (capture.index > edge) break;
        const px = x(capture.t);
        const py = y(capture.peakMa);
        if (started) context!.lineTo(px, py);
        else {
          context!.moveTo(px, py);
          started = true;
        }
      }
      context!.stroke();

      // Acquisition edge ------------------------------------------------------
      if (acquired < 1) {
        const index = Math.floor(edge);
        const capture = run.captures[Math.min(index, run.captures.length - 1)];
        const ex = x(capture.t);
        context!.strokeStyle = withAlpha(accent, 0.28);
        context!.lineWidth = 1;
        context!.beginPath();
        context!.moveTo(Math.round(ex) + 0.5, box.top - height * 0.16);
        context!.lineTo(Math.round(ex) + 0.5, baseY);
        context!.stroke();
      }

      // Marker ----------------------------------------------------------------
      const markerIndex = markerRef.current;
      if (markerIndex !== null && markerIndex <= edge) {
        const capture = run.captures[markerIndex];
        const mx = Math.round(x(capture.t)) + 0.5;
        context!.strokeStyle = withAlpha(accent, 0.5);
        context!.lineWidth = 1;
        context!.beginPath();
        context!.moveTo(mx, box.top - height * 0.16);
        context!.lineTo(mx, baseY);
        context!.stroke();

        context!.fillStyle = accent;
        context!.beginPath();
        context!.arc(x(capture.t), y(capture.peakMa), 2.5, 0, Math.PI * 2);
        context!.fill();
      }
    }

    function schedule() {
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(draw);
    }

    resize();
    draw();

    const observer = new ResizeObserver(() => {
      resize();
      draw();
    });
    observer.observe(host);

    const themeObserver = new MutationObserver(() => {
      paletteRef.current = readPalette(host);
      schedule();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    // Pointer acts as a marker: snap to the nearest acquired capture.
    const section = host.closest("section") ?? host.parentElement;
    function handlePointer(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      const rect = host!.getBoundingClientRect();
      const box = plotBox(rect.width, rect.height);
      const local = event.clientX - rect.left;
      if (local < 0 || local > rect.width) return;

      const acquired = Math.min(1, introRef.current * INTRO_SHARE + (1 - INTRO_SHARE) * scrollRef.current);
      const edge = Math.floor(acquired * (run.captures.length - 1));
      const raw = Math.round((local / box.width) * (run.captures.length - 1));
      const index = Math.max(0, Math.min(raw, edge));

      if (markerRef.current !== index) {
        markerRef.current = index;
        setMarker({ capture: run.captures[index], x: (run.captures[index].t / run.durationS) * box.width });
        schedule();
      }
    }
    function clearPointer() {
      markerRef.current = null;
      setMarker(null);
      schedule();
    }
    section?.addEventListener("pointermove", handlePointer);
    section?.addEventListener("pointerleave", clearPointer);

    // Acquisition ------------------------------------------------------------
    const reduced = prefersReducedMotion();
    const scope = gsap.context(() => {
      if (reduced) {
        introRef.current = 1;
        scrollRef.current = 1;
        draw();
        return;
      }

      gsap.to(introRef, {
        current: 1,
        duration: 2.4,
        delay: 0.45,
        ease: "power2.out",
        onUpdate: schedule,
      });

      if (section) {
        ScrollTrigger.create({
          trigger: section,
          start: "top top",
          end: "bottom top",
          scrub: true,
          onUpdate: (self) => {
            scrollRef.current = self.progress;
            schedule();
          },
        });
      }
    }, host);

    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      section?.removeEventListener("pointermove", handlePointer);
      section?.removeEventListener("pointerleave", clearPointer);
      scope.revert();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [run, thresholdMa]);

  // Readouts are HTML, not canvas: crisper text, real font tokens, and the
  // numbers stay in the accessibility tree.
  return (
    <div ref={hostRef} className={styles.host}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendLabel}>TX CURRENT DECAY</span>
        <span className={styles.legendMeta}>N6781A · TRIG 40 mA · {run.intervalS / 60} MIN INTERVAL</span>
      </div>

      <div className={styles.threshold} aria-hidden="true">
        <span>STOP {run.thresholdDb.toFixed(0)} dB</span>
      </div>

      {marker && (
        <div className={styles.marker} style={{ transform: `translateX(${marker.x}px)` }} aria-hidden="true">
          <span className={styles.markerRow}>
            <b>{marker.capture.peakMa.toFixed(1)}</b> mA
          </span>
          <span className={styles.markerRow}>
            {marker.capture.deltaDb >= 0 ? "+" : ""}
            {marker.capture.deltaDb.toFixed(2)} dB
          </span>
          <span className={styles.markerRow}>t {formatClock(marker.capture.t)}</span>
          <span className={styles.markerRow}>#{String(marker.capture.index + 1).padStart(3, "0")}</span>
        </div>
      )}

      <p className={styles.description}>
        A transmit-current decay run: {run.captures.length} bursts captured{" "}
        {run.intervalS / 60} minutes apart, peak current falling from{" "}
        {run.refMa.toFixed(0)} mA until it crossed the {run.thresholdDb} dB stop threshold after{" "}
        {formatClock(run.crossIndex >= 0 ? run.captures[run.crossIndex].t : run.durationS)}.
      </p>
    </div>
  );
}
