"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Cursor.module.css";

/**
 * The pointer.
 *
 * A marker, not a blob. It is the same object the dump draws around a byte:
 * a small crosshair that brackets whatever is under it, and it carries a word
 * when there is something worth saying. Over a project it says what will
 * happen, over the email it says Copy, over the dump it shrinks to a point so
 * it stops competing with the highlight the canvas is already drawing.
 *
 * It exists only for a fine pointer with motion allowed. On a touch device
 * this component renders nothing at all and the real cursor is never hidden.
 */

/** Time constant in ms, matching the dump and the tokens. */
const TAU = 55;
/** Below this the pointer is not really moving. */
const EPSILON = 0.1;

type Mode = "" | "view" | "open" | "copy" | "quiet";

/** What the cursor says over a given element, nearest wins. */
function modeFor(target: Element | null): Mode {
  if (!target) return "";
  const el = target.closest<HTMLElement>("[data-cursor]");
  if (el) return (el.dataset.cursor as Mode) ?? "";
  if (target.closest("a, button, input, textarea, label")) return "open";
  return "";
}

const LABEL: Record<Mode, string> = {
  "": "",
  view: "View",
  open: "",
  copy: "Copy",
  quiet: "",
};

export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>("");
  const [down, setDown] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || still.matches) return;

    setEnabled(true);

    let targetX = -100;
    let targetY = -100;
    let x = -100;
    let y = -100;
    let raf = 0;
    let running = false;
    let last = 0;
    let lastMove = 0;

    function frame(now: number) {
      const dt = Math.min(now - last, 64);
      last = now;
      const k = 1 - Math.exp(-dt / TAU);
      x += (targetX - x) * k;
      y += (targetY - y) * k;

      const dot = dotRef.current;
      if (dot) dot.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;

      /* Settled and nothing moving: stop until the pointer moves again. */
      if (
        Math.abs(targetX - x) < EPSILON &&
        Math.abs(targetY - y) < EPSILON &&
        now - lastMove > 120
      ) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function onMove(event: PointerEvent) {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      targetX = event.clientX;
      targetY = event.clientY;
      lastMove = performance.now();
      setMode(modeFor(event.target as Element));
      start();
    }

    function onLeave() {
      targetX = -100;
      targetY = -100;
      start();
    }

    /* A coarse pointer touching the screen means a hybrid device is being
       used as a tablet. Stand down until a real mouse moves again. */
    function onPointerDownAny(event: PointerEvent) {
      if (event.pointerType === "touch") setEnabled(false);
      else setDown(true);
    }

    function onPointerUp() {
      setDown(false);
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave, { passive: true });
    document.addEventListener("pointerdown", onPointerDownAny, { passive: true });
    document.addEventListener("pointerup", onPointerUp, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerdown", onPointerDownAny);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  if (!enabled) return null;

  const label = LABEL[mode];

  return (
    <div
      ref={dotRef}
      className={styles.cursor}
      data-mode={mode || undefined}
      data-down={down || undefined}
      aria-hidden="true"
    >
      <span className={styles.bracket} />
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
