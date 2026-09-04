"use client";

import { useEffect, useRef } from "react";
import styles from "./HeroSignalReveal.module.css";

/**
 * Cursor-revealed colour layer.
 *
 * Two canvases:
 *  - `mask` accumulates a soft brush wherever the pointer goes and fades it
 *    out a little every frame, so the trail decays behind the cursor.
 *  - `view` paints the full colour layer, then keeps only the pixels the mask
 *    covers (`destination-in`).
 *
 * When the pointer is idle a slow drift point paints the same trail at a much
 * lower strength, so the hero is never completely dead on arrival. The drift
 * fades out as soon as the pointer takes over.
 *
 * The colour layer is procedural (a lit signal field). To reveal a photo
 * instead, draw an <img> into `paintColourLayer` and set the base layer under
 * this canvas to `filter: saturate(0)`.
 */

const MAX_DPR = 1.75;
const BRUSH_RADIUS = 165;
/** Per-frame alpha removed from the trail. Higher = shorter tail. */
const DECAY = 0.045;
/** Pointer counts as idle this long after the last move. */
const IDLE_MS = 1500;
/** How long the drift takes to fade back in once the pointer goes idle. */
const DRIFT_FADE_MS = 1100;
/** Drift is deliberately far weaker than the cursor: a hint, not a rival. */
const CURSOR_STRENGTH = 0.42;
const DRIFT_STRENGTH = 0.085;

type Point = { x: number; y: number };

export default function HeroSignalReveal() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Pointer-driven and purely decorative: skip it where it cannot work or
    // is not wanted, rather than burning a rAF loop for nothing.
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (motionQuery.matches || !pointerQuery.matches) return;

    const view = document.createElement("canvas");
    view.className = styles.canvas;
    host.appendChild(view);
    const ctx = view.getContext("2d", { alpha: true });

    const mask = document.createElement("canvas");
    const maskCtx = mask.getContext("2d", { alpha: true });
    if (!ctx || !maskCtx) {
      view.remove();
      return;
    }

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let running = false;
    let onScreen = false;
    let lastMove = 0;
    let pointer: Point | null = null;
    let previous: Point | null = null;
    let previousDrift: Point | null = null;

    function resize() {
      const rect = host!.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = rect.width;
      height = rect.height;
      for (const canvas of [view, mask]) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      view.style.width = `${width}px`;
      view.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      maskCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** Soft round brush; overlapping stamps build the trail up smoothly. */
    function stamp(point: Point, strength: number, radius: number) {
      if (strength <= 0.002) return;
      const gradient = maskCtx!.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, radius,
      );
      gradient.addColorStop(0, `rgba(255,255,255,${strength})`);
      gradient.addColorStop(0.45, `rgba(255,255,255,${strength * 0.48})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      maskCtx!.fillStyle = gradient;
      maskCtx!.beginPath();
      maskCtx!.arc(point.x, point.y, radius, 0, Math.PI * 2);
      maskCtx!.fill();
    }

    /** Stamp along the segment travelled so a fast move paints a stroke. */
    function stampSegment(from: Point | null, to: Point, strength: number, radius: number) {
      if (from) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const steps = Math.min(24, Math.floor(Math.hypot(dx, dy) / (radius * 0.22)));
        for (let i = 1; i <= steps; i += 1) {
          stamp({ x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps }, strength, radius);
        }
      }
      stamp(to, strength, radius);
    }

    /**
     * Slow wander across the hero. Two incommensurate periods per axis so the
     * path does not visibly loop.
     */
    function driftPoint(t: number): Point {
      const x = 0.5 + 0.33 * Math.sin(t * 0.11) + 0.11 * Math.sin(t * 0.037 + 2.1);
      const y = 0.52 + 0.19 * Math.sin(t * 0.083 + 1.3) + 0.07 * Math.cos(t * 0.029);
      return { x: x * width, y: y * height };
    }

    function paintTrail(time: number) {
      // Fade what is already there.
      maskCtx!.globalCompositeOperation = "destination-out";
      maskCtx!.fillStyle = `rgba(0,0,0,${DECAY})`;
      maskCtx!.fillRect(0, 0, width, height);
      maskCtx!.globalCompositeOperation = "source-over";

      // 0 while the cursor is in charge, easing to 1 once it goes quiet.
      const idleFor = time - lastMove - IDLE_MS;
      const driftWeight = Math.max(0, Math.min(1, idleFor / DRIFT_FADE_MS));

      if (driftWeight > 0) {
        const point = driftPoint(time / 1000);
        stampSegment(previousDrift, point, DRIFT_STRENGTH * driftWeight, BRUSH_RADIUS * 0.95);
        previousDrift = point;
      } else {
        previousDrift = null;
      }

      if (pointer) {
        stampSegment(previous, pointer, CURSOR_STRENGTH, BRUSH_RADIUS);
        previous = { ...pointer };
      }
    }

    /** The colour that gets revealed: a lit signal field. */
    function paintColourLayer(time: number) {
      const t = time / 1000;
      ctx!.clearRect(0, 0, width, height);

      // Lit column grid, matching the hero's static 7-column rhythm.
      ctx!.lineWidth = 1;
      ctx!.strokeStyle = "rgba(85, 242, 164, 0.34)";
      for (let i = 1; i < 7; i += 1) {
        const x = Math.round((width * i) / 7) + 0.5;
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, height);
        ctx!.stroke();
      }

      // Faint horizontal graticule.
      ctx!.strokeStyle = "rgba(85, 242, 164, 0.1)";
      for (let i = 1; i < 6; i += 1) {
        const y = Math.round((height * i) / 6) + 0.5;
        ctx!.beginPath();
        ctx!.moveTo(0, y);
        ctx!.lineTo(width, y);
        ctx!.stroke();
      }

      const traces = [
        { amp: 0.13, freq: 2.1, speed: 0.22, colour: "rgba(85, 242, 164, 0.95)", w: 2, glow: true },
        { amp: 0.09, freq: 3.7, speed: -0.31, colour: "rgba(85, 242, 164, 0.4)", w: 1.25, glow: false },
        { amp: 0.055, freq: 6.3, speed: 0.44, colour: "rgba(75, 141, 255, 0.5)", w: 1, glow: false },
      ];

      const mid = height * 0.58;
      for (const trace of traces) {
        ctx!.beginPath();
        for (let x = 0; x <= width; x += 3) {
          const p = x / width;
          const y =
            mid +
            Math.sin(p * Math.PI * trace.freq + t * trace.speed * Math.PI) * height * trace.amp +
            Math.sin(p * Math.PI * trace.freq * 2.7 + t * trace.speed * 1.7) * height * trace.amp * 0.28;
          if (x === 0) ctx!.moveTo(x, y);
          else ctx!.lineTo(x, y);
        }
        ctx!.strokeStyle = trace.colour;
        ctx!.lineWidth = trace.w;
        if (trace.glow) {
          ctx!.shadowColor = "rgba(85, 242, 164, 0.75)";
          ctx!.shadowBlur = 14;
        }
        ctx!.stroke();
        ctx!.shadowBlur = 0;
      }

      // Spectrum ticks along the floor for texture.
      ctx!.fillStyle = "rgba(85, 242, 164, 0.5)";
      const step = 14;
      for (let x = 0; x < width; x += step) {
        const p = x / width;
        const bar = (Math.sin(p * 22 + t * 1.1) * 0.5 + 0.5) * (Math.sin(p * 7 - t * 0.6) * 0.5 + 0.5);
        const barHeight = 4 + bar * height * 0.11;
        ctx!.fillRect(x, height - barHeight, 2, barHeight);
      }
    }

    function frame(time: number) {
      paintTrail(time);
      paintColourLayer(time);

      // Keep only what the trail covers.
      ctx!.globalCompositeOperation = "destination-in";
      ctx!.drawImage(mask, 0, 0, width, height);
      ctx!.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(frame);
    }

    // The drift never goes idle on its own, so the loop is gated on the hero
    // actually being on screen and the tab being visible.
    function sync() {
      const shouldRun = onScreen && !document.hidden;
      if (shouldRun === running) return;
      running = shouldRun;
      if (running) {
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
        previous = null;
        previousDrift = null;
        ctx!.clearRect(0, 0, width, height);
        maskCtx!.clearRect(0, 0, width, height);
      }
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const rect = host!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      // Outside the hero: drop the cursor and let the drift take back over.
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        pointer = null;
        previous = null;
        return;
      }
      pointer = { x, y };
      lastMove = performance.now();
    }

    function onPointerLeave() {
      pointer = null;
      previous = null;
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const visibility = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    visibility.observe(host);

    // The canvas is pointer-transparent and sits behind the hero copy, so the
    // move has to be tracked on the document and mapped into host coordinates.
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("visibilitychange", sync);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibility.disconnect();
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", sync);
      view.remove();
    };
  }, []);

  return <div ref={hostRef} className={styles.host} aria-hidden="true" />;
}
