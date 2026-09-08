"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { readScene, watchScene } from "@/lib/appReady";
import styles from "./AppLoader.module.css";

/**
 * Held long enough to read as a deliberate opening rather than a stall, and
 * long enough for the sweep to land: every animation in the intro finishes by
 * this mark, so a wait past it holds on a completed drawing.
 */
const MIN_HOLD = 900;
/** If no hero has announced itself by now, this page has none to wait for. */
const NO_SCENE_GRACE = 400;
/** A hero that never reports back must not be able to hold the site hostage. */
const MAX_HOLD = 5000;
/** How long the name takes to fly onto the hero's heading. */
const MORPH = 700;
/** Long enough for that flight to land before the overlay goes. */
const EXIT = 740;

const SCROLL_KEYS = new Set([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"]);

/** The heading the intro's name flies into. */
const HERO_NAME = "hero-name";

/**
 * A damped capture: it arrives, rings through the middle of the frame, and
 * settles back to the baseline.
 */
const TRACE =
  "M0 80H175C222 80 226 26 272 26S320 134 366 134S414 38 460 38S508 122 554 122S602 56 648 56S696 104 742 104S790 70 836 70S884 90 930 90S978 78 1024 78S1072 82 1118 82H1200";

export default function AppLoader() {
  const [phase, setPhase] = useState<"playing" | "leaving" | "gone">("playing");
  const name = useRef<HTMLParagraphElement>(null);

  // Wear the hero heading's own type, so the flight into place is a straight
  // translation and every breakpoint stays in step without duplicating its
  // font-size rules here.
  useLayoutEffect(() => {
    const source = name.current;
    const target = document.getElementById(HERO_NAME);
    if (!source || !target) return;
    const type = getComputedStyle(target);
    source.style.fontSize = type.fontSize;
    source.style.fontWeight = type.fontWeight;
    source.style.letterSpacing = type.letterSpacing;
    source.style.lineHeight = type.lineHeight;
  }, []);

  useEffect(() => {
    const start = performance.now();
    let pending: ReturnType<typeof setTimeout> | undefined;
    let exiting: ReturnType<typeof setTimeout> | undefined;
    let left = false;

    function morph() {
      const source = name.current;
      const target = document.getElementById(HERO_NAME);
      if (!source || !target) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const from = source.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      // Two copies of the same name in flight would read as a double
      // exposure. The real one waits until this one lands on top of it.
      document.documentElement.setAttribute("data-intro-morph", "");
      // The entrance animates `transform` too, and a CSS animation outranks a
      // scripted one, so while it is still running it simply overwrites the
      // flight and the name lands without ever crossing the gap. Retiring it
      // first drops the element back to the settled style this animates from.
      for (const running of source.getAnimations()) running.cancel();
      source.animate?.(
        [
          { transform: "none" },
          { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px)` },
        ],
        // The site's expo-out is 76% travelled in its first quarter, which on a
        // journey this long still reads as a jump. This is the token set's
        // other curve, which spends its time in the middle of the move.
        { duration: MORPH, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" },
      );
    }

    function leave() {
      if (left) return;
      left = true;
      morph();
      setPhase("leaving");
      exiting = setTimeout(() => setPhase("gone"), EXIT);
    }

    function check() {
      if (left) return;
      const elapsed = performance.now() - start;
      const { declared, settled } = readScene();
      const heroDone = settled || (!declared && elapsed >= NO_SCENE_GRACE);

      // A declared but unsettled hero is still compiling shaders. Stop
      // polling and let it wake us through the subscription instead.
      if (!heroDone && declared) return;

      const wait = heroDone ? MIN_HOLD - elapsed : NO_SCENE_GRACE - elapsed;
      if (wait <= 0) {
        leave();
        return;
      }
      clearTimeout(pending);
      pending = setTimeout(check, wait);
    }

    const unwatch = watchScene(check);
    const cap = setTimeout(leave, MAX_HOLD);
    check();

    return () => {
      unwatch();
      clearTimeout(pending);
      clearTimeout(cap);
      clearTimeout(exiting);
      document.documentElement.removeAttribute("data-intro-morph");
    };
  }, []);

  // Scrolling under the overlay would advance the hero's scroll story out of
  // sight, so the page would come back mid-sequence. Blocking the input keeps
  // the scrollbar in place, which locking `overflow` would not.
  useEffect(() => {
    if (phase === "gone") return;
    const swallow = (event: Event) => event.preventDefault();
    const swallowKey = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) event.preventDefault();
    };
    window.addEventListener("wheel", swallow, { passive: false });
    window.addEventListener("touchmove", swallow, { passive: false });
    window.addEventListener("keydown", swallowKey);
    return () => {
      window.removeEventListener("wheel", swallow);
      window.removeEventListener("touchmove", swallow);
      window.removeEventListener("keydown", swallowKey);
    };
  }, [phase]);

  // The hero's own heading is uncovered in the same commit that removes this
  // one, with both sitting in the same place.
  useEffect(() => {
    if (phase !== "gone") return;
    document.documentElement.removeAttribute("data-intro-morph");
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div className={styles.overlay} data-app-loader data-phase={phase} aria-hidden="true">
      <div className={styles.stack}>
        <p ref={name} className={styles.name}>
          Yossi
          <br />
          Abutbul
        </p>
        <div className={styles.scope}>
          <svg className={styles.grid} viewBox="0 0 1200 190" fill="none">
            <line className={styles.baseline} x1="0" x2="1200" y1="168" y2="168" />
            <g className={styles.ticks}>
              {Array.from({ length: 41 }, (_, index) => {
                const x = index * 30;
                const major = index % 5 === 0;
                return (
                  <line
                    key={x}
                    x1={x}
                    x2={x}
                    y1={major ? 150 : 158}
                    y2="168"
                    style={{ animationDelay: `${100 + index * 10}ms` }}
                  />
                );
              })}
            </g>
          </svg>
          <svg className={styles.trace} viewBox="0 0 1200 190" fill="none">
            <path className={styles.glow} d={TRACE} />
            <path className={styles.line} d={TRACE} />
          </svg>
          <div className={styles.curtain} />
        </div>
      </div>
    </div>
  );
}
