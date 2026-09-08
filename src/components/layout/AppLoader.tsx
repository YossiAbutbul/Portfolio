"use client";

import { useEffect, useState } from "react";
import { readScene, watchScene } from "@/lib/appReady";
import styles from "./AppLoader.module.css";

/** Held long enough to read as a deliberate opening rather than a stall. */
const MIN_HOLD = 900;
/** If no hero has announced itself by now, this page has none to wait for. */
const NO_SCENE_GRACE = 400;
/** A hero that never reports back must not be able to hold the site hostage. */
const MAX_HOLD = 5000;
/** Matches the overlay's opacity transition in the stylesheet. */
const EXIT = 560;

const SCROLL_KEYS = new Set([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"]);

/**
 * A damped capture: it arrives, rings through the middle of the frame, and
 * settles back to the baseline. Normalised with pathLength so the sweep is one
 * unit of dash regardless of how the geometry is edited later.
 */
const TRACE =
  "M0 80H175C222 80 226 26 272 26S320 134 366 134S414 38 460 38S508 122 554 122S602 56 648 56S696 104 742 104S790 70 836 70S884 90 930 90S978 78 1024 78S1072 82 1118 82H1200";

export default function AppLoader() {
  const [phase, setPhase] = useState<"playing" | "leaving" | "gone">("playing");

  useEffect(() => {
    const start = performance.now();
    let pending: ReturnType<typeof setTimeout> | undefined;
    let exiting: ReturnType<typeof setTimeout> | undefined;
    let left = false;

    function leave() {
      if (left) return;
      left = true;
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

  if (phase === "gone") return null;

  return (
    <div className={styles.overlay} data-app-loader data-phase={phase} aria-hidden="true">
      <div className={styles.stack}>
        <p className={styles.name}>Yossi Abutbul</p>
        <svg className={styles.trace} viewBox="0 0 1200 190" fill="none">
          <path className={styles.glow} d={TRACE} pathLength={1} />
          <path className={styles.line} d={TRACE} pathLength={1} />
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
                  style={{ animationDelay: `${180 + index * 18}ms` }}
                />
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
