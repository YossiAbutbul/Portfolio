"use client";

import { useEffect, useRef } from "react";
import styles from "./HeroDump.module.css";

/**
 * The hero object: a live hex dump.
 *
 * It is laid out the way xxd lays one out, because that is the thing it is
 * imitating: an offset column, sixteen hex pairs, then an ASCII gutter. Most
 * of the file is noise. The rows that are not noise spell something real, so
 * reading down the gutter turns up the name, the projects and the stack.
 *
 * Interaction is the one a hex editor has and nothing else does: the cursor
 * selects a byte, and that byte is marked in both columns at once. Move
 * across the field and the two highlights track together.
 *
 * Cost control:
 *  - Only dirty rows repaint. Once the entrance has settled and the pointer
 *    is still, the loop stops and the canvas is not touched again.
 *  - The glyph advance is measured once and forced, so the columns line up in
 *    a proportional face and no monospace font is loaded.
 *  - dpr is clamped, the loop pauses off screen and on tab hide, and the
 *    whole thing is skipped for reduced motion and coarse pointers after one
 *    static paint.
 */

const MAX_DPR = 2;
const LINE_RATIO = 1.62;
/** Pointer easing time constant, in ms. Matches --ease-track in the tokens. */
const TRACK_TAU = 90;
/** Entrance: how long the resolve sweep takes to cross the field. */
const SWEEP_MS = 900;
/** How long a single row takes to settle once the sweep reaches it. */
const ROW_MS = 260;
/** Movement below this is jitter, not a move. */
const MOVE_EPSILON = 0.5;

/** Deterministic, so the field is identical on every load and in every shot. */
function mulberry32(seed: number) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The strings that surface out of the noise. Real ones only: the name, the
 * project slugs, the things actually in the stack.
 */
const STRINGS = [
  "YOSSI ABUTBUL",
  "rf-report-generator",
  "lora-viz",
  "oplanner",
  "toast-turn",
  "haparlamentor",
  "pipeline-cpu",
  "python",
  "typescript",
  "fastapi",
  "spectrum analyser",
  "power sensor",
  "embedded",
];

/** Every character the field can print: hex digits, the filler, the strings. */
const CHARSET = Array.from(new Set(("0123456789abcdef." + STRINGS.join("")).split("")));

interface Row {
  /** Byte offset of the first byte in the row. */
  offset: number;
  bytes: Uint8Array;
  /** True where the byte belongs to one of the strings above. */
  real: Uint8Array;
  /** Per byte, the point in the row's settle at which it stops re-rolling.
      Staggered so the words assemble letter by letter rather than snapping. */
  lock: Float32Array;
  /** 0 to 1. Below 1 the row is still resolving and re-rolls every frame. */
  settled: number;
}

export default function HeroDump({ className = "" }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement("canvas");
    canvas.className = styles.canvas;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    host.appendChild(canvas);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    /* Colours come from the tokens rather than being repeated here, so the
       object follows a palette change like everything else. */
    const styleOf = getComputedStyle(host);
    const COLOR = {
      offset: styleOf.getPropertyValue("--dump-offset").trim() || "#8a9599",
      hex: styleOf.getPropertyValue("--dump-hex").trim() || "#5fc6d4",
      ascii: styleOf.getPropertyValue("--dump-ascii").trim() || "#e9eae4",
      mark: styleOf.getPropertyValue("--dump-mark").trim() || "#ffb02e",
    };
    const fontFamily = styleOf.fontFamily;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let fontSize = 13;
    let lineHeight = 21;
    let advance = 8;
    let cols = 16;
    let padX = 0;
    let padY = 0;
    let rows: Row[] = [];

    let raf = 0;
    let running = false;
    let onScreen = true;
    let startedAt = 0;
    /* Matches the entrance gate in the layout: same tab, no replay. */
    let seen = false;
    try {
      seen = sessionStorage.getItem("seen") === "1";
    } catch {
      // No storage, so treat it as a first visit and play the entrance.
    }
    let entranceDone = reduced.matches || seen;
    let lastMove = 0;

    /* Pointer, in canvas pixels. Target is where it is, current is where the
       highlight has eased to. */
    let targetX = -1;
    let targetY = -1;
    let curX = -1;
    let curY = -1;
    let hoverRow = -1;
    let hoverCol = -1;
    let lastFrame = 0;

    /** Rows repainted on the next frame. */
    const dirty = new Set<number>();

    function measure() {
      fontSize = width < 640 ? 11 : 13;
      lineHeight = Math.round(fontSize * LINE_RATIO);
      ctx!.font = `500 ${fontSize}px ${fontFamily}`;

      /* Forced advance: the widest glyph the field can actually draw. Measured
         over the real charset rather than a generic alphabet, because letters
         nothing ever prints (M and W, mostly) would inflate the pitch by more
         than half and leave the columns swimming. */
      let widest = 0;
      for (const ch of CHARSET) {
        widest = Math.max(widest, ctx!.measureText(ch).width);
      }
      advance = widest;

      /* A row is: 4 offset + 2 gap + (3n - 1) hex + 2 gap + n ascii. */
      const usable = width - fontSize * 2;
      const fit = Math.floor((usable / advance - 7) / 4);
      cols = fit >= 16 ? 16 : fit >= 8 ? 8 : 4;

      padX = fontSize * 1.6;
      padY = fontSize;
    }

    function build() {
      const rowCount = Math.max(1, Math.ceil((height - padY * 2) / lineHeight));
      const random = mulberry32(0x59_4f_53_53);
      const next: Row[] = [];

      /* Strings are dropped in at a steady but not regular cadence, so the
         gutter has something to find every few rows without looking laid out
         on a grid. */
      let stringIndex = 0;
      let nextStringRow = 1;

      for (let r = 0; r < rowCount; r += 1) {
        const bytes = new Uint8Array(cols);
        const real = new Uint8Array(cols);
        const lock = new Float32Array(cols);
        for (let c = 0; c < cols; c += 1) {
          bytes[c] = Math.floor(random() * 256);
          lock[c] = 0.35 + random() * 0.6;
        }

        if (r === nextStringRow && stringIndex < STRINGS.length) {
          const text = STRINGS[stringIndex];
          stringIndex += 1;
          const start = cols > 8 ? 1 + Math.floor(random() * 2) : 0;
          for (let i = 0; i < text.length && start + i < cols; i += 1) {
            bytes[start + i] = text.charCodeAt(i);
            real[start + i] = 1;
          }
          nextStringRow = r + 2 + Math.floor(random() * 3);
        }

        next.push({
          offset: r * cols,
          bytes,
          real,
          lock,
          settled: entranceDone ? 1 : 0,
        });
      }

      rows = next;
      for (let r = 0; r < rows.length; r += 1) dirty.add(r);
    }

    function resize() {
      const rect = host!.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      measure();
      build();
      paint(performance.now(), true);
    }

    /** x pixel of character slot `i` in a row. */
    function slotX(i: number) {
      return padX + i * advance;
    }

    /** Character slot where the hex pair for byte `c` starts. */
    function hexSlot(c: number) {
      return 6 + c * 3;
    }

    function asciiSlot(c: number) {
      return 6 + cols * 3 + 1 + c;
    }

    function drawText(text: string, slot: number, y: number) {
      for (let i = 0; i < text.length; i += 1) {
        ctx!.fillText(text[i], slotX(slot + i), y);
      }
    }

    function drawRow(r: number, now: number) {
      const row = rows[r];
      if (!row) return;
      const y = padY + r * lineHeight;

      ctx!.clearRect(0, y - lineHeight * 0.2, width, lineHeight);
      ctx!.font = `500 ${fontSize}px ${fontFamily}`;
      ctx!.textBaseline = "alphabetic";

      const baseline = y + fontSize * 0.9;
      const selected = r === hoverRow;

      /* A row still resolving re-rolls the bytes it does not own, so the
         field reads as settling rather than fading in. */
      const settling = row.settled < 1;
      const noise = settling ? mulberry32((now | 0) + r * 7919) : null;

      if (selected) {
        ctx!.fillStyle = COLOR.mark;
        ctx!.globalAlpha = 0.07;
        ctx!.fillRect(0, y - lineHeight * 0.15, width, lineHeight * 0.95);
        ctx!.globalAlpha = 1;
      }

      /* Offset column. */
      ctx!.fillStyle = selected ? COLOR.mark : COLOR.offset;
      ctx!.globalAlpha = selected ? 1 : 0.58 * row.settled;
      drawText(row.offset.toString(16).padStart(4, "0"), 0, baseline);

      /* Hex columns. */
      for (let c = 0; c < cols; c += 1) {
        const open = settling && row.settled < row.lock[c];
        const value = open ? Math.floor(noise!() * 256) : row.bytes[c];
        const marked = selected && c === hoverCol;
        ctx!.fillStyle = marked ? COLOR.mark : COLOR.hex;
        ctx!.globalAlpha = marked ? 1 : (row.real[c] ? 0.9 : 0.46) * (0.3 + 0.7 * row.settled);
        drawText(value.toString(16).padStart(2, "0"), hexSlot(c), baseline);
      }

      /* ASCII gutter. This is where the strings surface. */
      for (let c = 0; c < cols; c += 1) {
        const open = settling && row.settled < row.lock[c];
        const value = open ? Math.floor(noise!() * 256) : row.bytes[c];
        const printable = value >= 0x20 && value <= 0x7e;
        const char = !open && row.real[c] && printable ? String.fromCharCode(value) : ".";
        const marked = selected && c === hoverCol;
        ctx!.fillStyle = marked ? COLOR.mark : COLOR.ascii;
        ctx!.globalAlpha = marked ? 1 : (row.real[c] ? 1 : 0.22) * (0.3 + 0.7 * row.settled);
        drawText(char, asciiSlot(c), baseline);
      }

      ctx!.globalAlpha = 1;

      /* The linked cursor: one box in the hex column, one in the gutter. */
      if (selected && hoverCol >= 0) {
        ctx!.strokeStyle = COLOR.mark;
        ctx!.globalAlpha = 0.85;
        ctx!.lineWidth = 1;
        const top = y - lineHeight * 0.1;
        const boxH = lineHeight * 0.88;
        ctx!.strokeRect(
          Math.round(slotX(hexSlot(hoverCol))) - 2.5,
          Math.round(top) + 0.5,
          Math.round(advance * 2) + 4,
          Math.round(boxH),
        );
        ctx!.strokeRect(
          Math.round(slotX(asciiSlot(hoverCol))) - 2.5,
          Math.round(top) + 0.5,
          Math.round(advance) + 4,
          Math.round(boxH),
        );
        ctx!.globalAlpha = 1;
      }
    }

    function paint(now: number, all = false) {
      if (all) {
        ctx!.clearRect(0, 0, width, height);
        for (let r = 0; r < rows.length; r += 1) drawRow(r, now);
        return;
      }
      for (const r of dirty) drawRow(r, now);
      dirty.clear();
    }

    function frame(now: number) {
      const dt = Math.min(now - lastFrame, 64);
      lastFrame = now;

      /* Entrance: a sweep down the field, each row easing over ROW_MS. */
      if (!entranceDone) {
        const elapsed = now - startedAt;
        let pending = false;
        for (let r = 0; r < rows.length; r += 1) {
          const row = rows[r];
          if (row.settled >= 1) continue;
          const rowStart = (r / Math.max(1, rows.length - 1)) * SWEEP_MS;
          const p = (elapsed - rowStart) / ROW_MS;
          const value = p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.pow(1 - p, 3);
          if (value !== row.settled) {
            row.settled = value;
            dirty.add(r);
          }
          if (value < 1) pending = true;
        }
        if (!pending) entranceDone = true;
      }

      /* Pointer easing against wall clock, so it feels the same at any
         refresh rate. */
      if (targetX >= 0) {
        const k = 1 - Math.exp(-dt / TRACK_TAU);
        curX = curX < 0 ? targetX : curX + (targetX - curX) * k;
        curY = curY < 0 ? targetY : curY + (targetY - curY) * k;

        const nextRow = Math.max(
          0,
          Math.min(rows.length - 1, Math.floor((curY - padY) / lineHeight)),
        );
        const slot = Math.round((curX - padX) / advance);
        let nextCol = -1;
        if (slot >= 6 && slot < 6 + cols * 3) nextCol = Math.floor((slot - 6) / 3);
        else if (slot >= 6 + cols * 3 + 1) nextCol = slot - (6 + cols * 3 + 1);
        if (nextCol >= cols) nextCol = cols - 1;
        if (nextCol < 0) nextCol = 0;

        if (nextRow !== hoverRow || nextCol !== hoverCol) {
          if (hoverRow >= 0) dirty.add(hoverRow);
          dirty.add(nextRow);
          hoverRow = nextRow;
          hoverCol = nextCol;
        }
      }

      paint(now);

      const pointerSettled =
        targetX < 0 || (Math.abs(targetX - curX) < 0.4 && Math.abs(targetY - curY) < 0.4);
      const idle = entranceDone && pointerSettled && now - lastMove > 200;
      if (idle) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || !onScreen || document.hidden) return;
      running = true;
      lastFrame = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const rect = host!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      if (Math.abs(x - targetX) < MOVE_EPSILON && Math.abs(y - targetY) < MOVE_EPSILON) {
        return;
      }
      targetX = x;
      targetY = y;
      lastMove = performance.now();
      start();
    }

    function onPointerLeave() {
      if (hoverRow >= 0) dirty.add(hoverRow);
      targetX = -1;
      targetY = -1;
      curX = -1;
      curY = -1;
      hoverRow = -1;
      hoverCol = -1;
      lastMove = performance.now();
      start();
    }

    let disposed = false;

    resize();

    /* Metrics measured against the fallback face would put the columns on the
       wrong pitch, so remeasure once the real one has arrived. */
    if (document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(() => {
        if (!disposed) resize();
      });
    }

    if (!reduced.matches) {
      startedAt = performance.now();
      start();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const visibility = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) {
          start();
        } else {
          cancelAnimationFrame(raf);
          running = false;
        }
      },
      { threshold: 0 },
    );
    visibility.observe(host);

    function onVisibilityChange() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        running = false;
      } else {
        start();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    if (finePointer.matches && !reduced.matches) {
      document.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("pointerleave", onPointerLeave, { passive: true });
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      canvas.remove();
    };
  }, []);

  return <div ref={hostRef} className={`${styles.host} ${className}`} aria-hidden="true" />;
}
