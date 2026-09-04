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
  * Nothing is painted unless the pointer actually moves. Holding still adds no
 * new brush, so the trail decays to nothing and the loop shuts itself down.
 *
 * The colour layer is procedural (a lit signal field). To reveal a photo
 * instead, draw an <img> into `paintColourLayer` and set the base layer under
 * this canvas to `filter: saturate(0)`.
 */

const MAX_DPR = 1.75;
const BRUSH_RADIUS = 125;
/**
 * How long the trail keeps half its strength. Short enough to read as a brief
 * memory behind the cursor, not a lingering smear. Time-based rather than
 * per-frame, so the fade looks the same on a 60Hz and a 144Hz display.
 */
const TRAIL_HALF_LIFE_MS = 250;
/** Longest frame gap the decay will honour, so a stall cannot wipe the trail. */
const MAX_FRAME_MS = 64;
const CURSOR_STRENGTH = 0.62;
/** By this point the trail is at ~0.4% alpha: invisible, safe to clear. */
const FADE_OUT_MS = 2000;
/** Movement below this is jitter, not a move. */
const MOVE_EPSILON = 0.4;

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
    let moved = false;
    let lastFrame = 0;

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
      gradient.addColorStop(0.55, `rgba(255,255,255,${strength * 0.74})`);
      gradient.addColorStop(0.85, `rgba(255,255,255,${strength * 0.16})`);
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

    function paintTrail(dt: number) {
      // Exponential decay on wall-clock time: the trail loses half its
      // strength every TRAIL_HALF_LIFE_MS regardless of frame rate.
      const fade = 1 - Math.pow(2, -dt / TRAIL_HALF_LIFE_MS);
      maskCtx!.globalCompositeOperation = "destination-out";
      maskCtx!.fillStyle = `rgba(0,0,0,${fade})`;
      maskCtx!.fillRect(0, 0, width, height);
      maskCtx!.globalCompositeOperation = "source-over";

      // Only paint where the pointer actually travelled this frame. A still
      // pointer adds nothing, so what is already on the mask just decays.
      if (pointer && moved) {
        stampSegment(previous, pointer, CURSOR_STRENGTH, BRUSH_RADIUS);
        previous = { ...pointer };
        moved = false;
      }
    }

    /**
     * The colour hidden under the hero.
     *
     * The reference site desaturates a photograph and lets the cursor uncover
     * the photo's own colour. There is no hero photograph here, so the hidden
     * layer is a saturated spectrum field instead: hue is mapped to x, so
     * sweeping the cursor sweeps the band and uncovers a different colour at
     * each position, the way sweeping their photo does.
     */
    function paintColourLayer(time: number) {
      const t = time / 1000;
      ctx!.clearRect(0, 0, width, height);

      // Spectrum wash, low -> high frequency across the width.
      const band = ctx!.createLinearGradient(0, 0, width, 0);
      const hueShift = (Math.sin(t * 0.06) + 1) * 0.5 * 0.08;
      band.addColorStop(0, "rgba(96, 62, 208, 0.85)");
      band.addColorStop(Math.min(0.99, 0.2 + hueShift), "rgba(42, 116, 232, 0.85)");
      band.addColorStop(Math.min(0.99, 0.43 + hueShift), "rgba(28, 198, 196, 0.85)");
      band.addColorStop(Math.min(0.99, 0.66 + hueShift), "rgba(85, 242, 164, 0.9)");
      band.addColorStop(Math.min(0.99, 0.85 + hueShift), "rgba(206, 232, 92, 0.85)");
      band.addColorStop(1, "rgba(255, 168, 58, 0.85)");
      ctx!.fillStyle = band;
      ctx!.fillRect(0, 0, width, height);

      // Fade the wash top and bottom so the uncovered patch has depth rather
      // than looking like flat paint.
      const depth = ctx!.createLinearGradient(0, 0, 0, height);
      depth.addColorStop(0, "rgba(4, 9, 16, 0.72)");
      depth.addColorStop(0.45, "rgba(4, 9, 16, 0.12)");
      depth.addColorStop(1, "rgba(4, 9, 16, 0.82)");
      ctx!.globalCompositeOperation = "source-atop";
      ctx!.fillStyle = depth;
      ctx!.fillRect(0, 0, width, height);
      ctx!.globalCompositeOperation = "source-over";

      // Lit column grid, matching the hero's static 7-column rhythm.
      ctx!.lineWidth = 1;
      ctx!.strokeStyle = "rgba(255, 255, 255, 0.22)";
      for (let i = 1; i < 7; i += 1) {
        const x = Math.round((width * i) / 7) + 0.5;
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, height);
        ctx!.stroke();
      }

      const traces = [
        { amp: 0.13, freq: 2.1, speed: 0.22, colour: "rgba(255, 255, 255, 0.9)", w: 2 },
        { amp: 0.09, freq: 3.7, speed: -0.31, colour: "rgba(255, 255, 255, 0.4)", w: 1.25 },
        { amp: 0.055, freq: 6.3, speed: 0.44, colour: "rgba(10, 20, 30, 0.45)", w: 1 },
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
        ctx!.stroke();
      }

      // Spectrum ticks along the floor for texture.
      ctx!.fillStyle = "rgba(255, 255, 255, 0.5)";
      const step = 14;
      for (let x = 0; x < width; x += step) {
        const p = x / width;
        const bar = (Math.sin(p * 22 + t * 1.1) * 0.5 + 0.5) * (Math.sin(p * 7 - t * 0.6) * 0.5 + 0.5);
        const barHeight = 4 + bar * height * 0.11;
        ctx!.fillRect(x, height - barHeight, 2, barHeight);
      }
    }

    function frame(time: number) {
      const dt = Math.min(time - lastFrame, MAX_FRAME_MS);
      lastFrame = time;
      paintTrail(dt);
      paintColourLayer(time);

      // Keep only what the trail covers.
      ctx!.globalCompositeOperation = "destination-in";
      ctx!.drawImage(mask, 0, 0, width, height);
      ctx!.globalCompositeOperation = "source-over";

      // Pointer has been still long enough for the trail to be gone: clear up
      // and stop, so a stationary cursor costs nothing at all.
      if (time - lastMove > FADE_OUT_MS) {
        stop();
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || !onScreen || document.hidden) return;
      running = true;
      // Seed the clock so the first frame cannot report a huge delta.
      lastFrame = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      previous = null;
      moved = false;
      ctx!.clearRect(0, 0, width, height);
      maskCtx!.clearRect(0, 0, width, height);
    }

    // The loop is only ever started by pointer movement; this just tears it
    // down when the hero scrolls away or the tab is hidden.
    function sync() {
      if (!onScreen || document.hidden) stop();
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const rect = host!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      // Outside the hero: drop the cursor and let the trail decay out.
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        pointer = null;
        previous = null;
        moved = false;
        return;
      }
      // Ignore sub-pixel jitter: it would keep the effect alive on a cursor
      // that is not really moving.
      if (pointer && Math.hypot(x - pointer.x, y - pointer.y) < MOVE_EPSILON) return;

      pointer = { x, y };
      moved = true;
      lastMove = performance.now();
      start();
    }

    function onPointerLeave() {
      pointer = null;
      previous = null;
      moved = false;
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
