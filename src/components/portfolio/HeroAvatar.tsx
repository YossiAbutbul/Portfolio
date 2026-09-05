"use client";

import { useEffect, useRef, useState } from "react";
import AvatarRuntime from "./AvatarRuntime";
import styles from "./HeroAvatar.module.css";

/**
 * The avatar that sits beside the name in the hero.
 *
 * It holds a resting pose and the eyes track the cursor. The runtime exposes
 * expressions and animations but no gaze control, so the eyes are translated
 * directly on the rendered geometry, and the blink is driven here too - a
 * controlled pose runs no sequence, so nothing else would blink for us.
 */

/** Resting pose: a slight glance left, toward the name it stands beside. */
const RESTING_POSE = "gentle-downward-gaze";

/** Body lean toward the cursor, in px. Small, so the eyes do the looking. */
const LEAN_X = 5;
const LEAN_Y = 3;

/** Eye travel, in SVG user units (the face spans 300, the body 250). */
const GAZE_X = 30;
const GAZE_Y = 21;
/** Easing time constant in ms, applied against wall-clock time so the glide
 *  feels the same on a 60Hz and a 144Hz display. */
const GAZE_TAU = 95;

const BLINK_MIN_MS = 2600;
const BLINK_MAX_MS = 6800;
const BLINK_MS = 130;
const DOUBLE_BLINK_CHANCE = 0.2;

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

export default function HeroAvatar({ definition }: { definition?: unknown | null }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gazeTarget = useRef<[number, number]>([0, 0]);
  const [lean, setLean] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    if (!definition) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    function onMove(event: PointerEvent) {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const box = hostRef.current?.getBoundingClientRect();
      if (!box) return;

      // Aimed from the avatar itself, so it tracks the cursor rather than
      // mirroring its position relative to the middle of the screen.
      const dx = (event.clientX - (box.left + box.width / 2)) / (window.innerWidth / 2);
      const dy = (event.clientY - (box.top + box.height / 2)) / (window.innerHeight / 2);
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));

      gazeTarget.current = [clamp(dx) * GAZE_X, clamp(dy) * GAZE_Y];
      setLean([clamp(dx) * LEAN_X, clamp(dy) * LEAN_Y]);
    }

    function onLeave() {
      gazeTarget.current = [0, 0];
      setLean([0, 0]);
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [definition]);

  useEffect(() => {
    if (!definition) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const bodyColour = String(
      (definition as { colors?: { body?: string } })?.colors?.body ?? "",
    ).toLowerCase();

    let raf = 0;
    let x = 0;
    let y = 0;
    let last = performance.now();
    let nextBlink = performance.now() + randomBetween(BLINK_MIN_MS, BLINK_MAX_MS);
    let blinkStart = 0;

    function paintEyes(now: number) {
      const dt = Math.min(now - last, 64);
      last = now;
      const k = 1 - Math.exp(-dt / GAZE_TAU);
      const [tx, ty] = gazeTarget.current;
      x += (tx - x) * k;
      y += (ty - y) * k;

      // Clamp to an ellipse so diagonals cannot slide the eyes off the face.
      const reach = Math.hypot(x / GAZE_X, y / GAZE_Y);
      const cx = reach > 1 ? x / reach : x;
      const cy = reach > 1 ? y / reach : y;

      // Lids: a sine dip, so the eye closes and opens in one motion.
      let lid = 1;
      if (!blinkStart && now >= nextBlink) blinkStart = now;
      if (blinkStart) {
        const p = (now - blinkStart) / BLINK_MS;
        if (p >= 1) {
          blinkStart = 0;
          nextBlink =
            now +
            (Math.random() < DOUBLE_BLINK_CHANCE
              ? 150
              : randomBetween(BLINK_MIN_MS, BLINK_MAX_MS));
        } else {
          lid = 1 - Math.sin(p * Math.PI) * 0.92;
        }
      }

      const svg = hostRef.current?.querySelector("svg");
      if (svg) {
        // Re-applied every frame: the runtime rewrites the path data as it
        // renders, so anything set once would be dropped on the next tick.
        const shift = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px) scaleY(${lid.toFixed(3)})`;
        for (const path of svg.querySelectorAll("path")) {
          const fill = (path.getAttribute("fill") ?? "").toLowerCase();
          // Anything that is not the body is an eye. Matching by exclusion
          // keeps working when an expression overrides the eye colour.
          if (!fill || fill === "none" || fill === bodyColour) continue;
          path.style.transformBox = "fill-box";
          path.style.transformOrigin = "center";
          path.style.transform = shift;
        }
      }
      raf = requestAnimationFrame(paintEyes);
    }

    raf = requestAnimationFrame(paintEyes);

    function onVisibility() {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(paintEyes);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [definition]);

  if (!definition) return null;

  return (
    <div ref={hostRef} className={styles.avatar} aria-hidden="true">
      <div
        className={styles.lean}
        style={{ transform: `translate(${lean[0].toFixed(1)}px, ${lean[1].toFixed(1)}px)` }}
      >
        <AvatarRuntime definition={definition} expression={RESTING_POSE} size="100%" />
      </div>
    </div>
  );
}
