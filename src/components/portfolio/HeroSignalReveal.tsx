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
 * The mask is rebuilt from scratch every frame with a single brush at the
 * cursor, so nothing accumulates and there is no trail behind the pointer.
 * Stop moving and it fades out; the loop then shuts itself down.
 *
 * The colour layer is procedural (a lit signal field). To reveal a photo
 * instead, draw an <img> into `paintColourLayer` and set the base layer under
 * this canvas to `filter: saturate(0)`.
 */

const MAX_DPR = 1.75;
const BRUSH_RADIUS = 125;
/** Single stamp per frame, so this is the patch alpha outright. Kept low:
 *  the point is to just catch the lines underneath, not spotlight them. */
const CURSOR_STRENGTH = 0.6;
/** Grace before a pause counts as stopping, so slow moves do not flicker. */
const STOP_GRACE_MS = 140;
/** Quick fade once movement stops. Fades in place - never trails. */
const FADE_OUT_MS = 220;
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
    let visible = 0;

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

    function paintMask() {
      // Rebuilt every frame rather than accumulated, so the patch sits at the
      // cursor and leaves nothing behind it.
      maskCtx!.clearRect(0, 0, width, height);
      if (pointer && visible > 0) {
        stamp(pointer, CURSOR_STRENGTH * visible, BRUSH_RADIUS);
      }
    }

    /**
     * What sits under the hero: the same signal field, drawn brighter. The
     * cursor uncovers the animated traces and grid rather than painting a
     * colour of its own, so the effect reads as lighting up what is already
     * there instead of a glow following the mouse.
     */
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
        { amp: 0.13, freq: 2.1, speed: 0.22, colour: "rgba(85, 242, 164, 0.95)", w: 2 },
        { amp: 0.09, freq: 3.7, speed: -0.31, colour: "rgba(85, 242, 164, 0.4)", w: 1.25 },
        { amp: 0.055, freq: 6.3, speed: 0.44, colour: "rgba(75, 141, 255, 0.5)", w: 1 },
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
      // Full while moving, then a short fade in place once the cursor stops.
      const still = time - lastMove - STOP_GRACE_MS;
      visible = still <= 0 ? 1 : Math.max(0, 1 - still / FADE_OUT_MS);

      paintMask();
      paintColourLayer(time);

      // Keep only what the mask covers.
      ctx!.globalCompositeOperation = "destination-in";
      ctx!.drawImage(mask, 0, 0, width, height);
      ctx!.globalCompositeOperation = "source-over";

      // Faded out: nothing to show, so stop rather than spin.
      if (visible <= 0) {
        stop();
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || !onScreen || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      visible = 0;
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
        return;
      }
      // Ignore sub-pixel jitter: it would keep the effect alive on a cursor
      // that is not really moving.
      if (pointer && Math.hypot(x - pointer.x, y - pointer.y) < MOVE_EPSILON) return;

      pointer = { x, y };
      lastMove = performance.now();
      start();
    }

    function onPointerLeave() {
      pointer = null;
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
