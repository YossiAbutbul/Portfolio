"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { readScene, watchScene } from "@/lib/appReady";
import styles from "./AppLoader.module.css";

/**
 * Held long enough to read as a deliberate opening rather than a stall, and
 * long enough for the sweep to land: every animation in the intro finishes by
 * this mark (the curtain, the last of them, at 1850), so a wait past it holds
 * on a completed drawing rather than cutting one short.
 */
const MIN_HOLD = 1950;
/** If no hero has announced itself by now, this page has none to wait for. */
const NO_SCENE_GRACE = 400;
/** A hero that never reports back must not be able to hold the site hostage. */
const MAX_HOLD = 5000;
/** How long the name takes to fly onto the hero's heading. */
const MORPH = 1000;
/** Long enough for that flight to land before the overlay goes. */
const EXIT = 1040;

/**
 * The climb is deliberately quick. Fetching and parsing the WebGL module
 * blocks the main thread from around 400ms, and text can only be repainted on
 * that thread, so wherever the count has got to by then is where it sits until
 * the thread comes back. A slower climb simply parks it at a lower number.
 */
const CLIMB = 900;
/**
 * Points per second once the scene is ready. A steady count rather than an
 * eased one: easing puts most of the distance in its first fifth, which from
 * a number the compile has left sitting at 48 just reads as a jump to 100.
 * Slow enough that the last stretch is read rather than glimpsed.
 */
const RATE = 42;
/** However far behind the count is, it may not delay the page beyond this. */
const COUNT_OUT = 1.3;
/**
 * What the readout may claim before each milestone lands: hero mounted, WebGL
 * module arrived, first frame drawn. The climb between the first two is a
 * clock; from the second on, the scene's warm-up reports real progress and the
 * ceiling rises with it. Either way the ceilings are the honest part: the
 * number cannot claim a milestone that has not actually happened.
 */
const CEIL = [22, 60, 96];

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
  const readout = useRef<HTMLSpanElement>(null);
  const release = useRef<() => void>(() => {});
  const counted = useRef(false);

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
      const now = performance.now();
      const elapsed = now - start;
      const { declared, settled } = readScene();
      const heroDone = settled || (!declared && elapsed >= NO_SCENE_GRACE);

      // A declared but unsettled hero is still compiling shaders. Stop
      // polling and let it wake us through the subscription instead.
      if (!heroDone && declared) return;

      // Leaving mid-count would undo the point of counting, so the readout
      // gets to finish. It is the readout that decides when, since only it
      // knows how far it still has to travel.
      const wait = heroDone
        ? counted.current
          ? MIN_HOLD - elapsed
          : 80
        : NO_SCENE_GRACE - elapsed;
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

  // Take the scrollbar away for the duration, and give its width back as
  // padding. Without that the page widens the moment the bar goes and narrows
  // again when it returns — a shift of some fifteen pixels landing in the
  // middle of the name's flight, which is measured against these positions.
  //
  // `overflow: hidden` only stops the user's own scrolling; the position can
  // still be set from script, which is exactly what Lenis does with every
  // wheel event it sees. So it has to be stopped by name, and it is built
  // asynchronously — hence the wait for it to turn up.
  useEffect(() => {
    const root = document.documentElement;
    const bar = window.innerWidth - root.clientWidth;
    const overflowWas = root.style.overflow;
    const padWas = root.style.paddingRight;
    root.style.overflow = "hidden";
    if (bar > 0) root.style.paddingRight = `${bar}px`;

    const muzzle = setInterval(() => window.__lenis?.stop(), 60);
    window.__lenis?.stop();

    release.current = () => {
      clearInterval(muzzle);
      root.style.overflow = overflowWas;
      root.style.paddingRight = padWas;
      // Whatever the page did while it was covered, it is handed over at the
      // top. Anything else drops the reader into the middle of the hero's
      // scroll story with no idea how they got there.
      window.scrollTo(0, 0);
      window.__lenis?.start();
      window.__lenis?.scrollTo(0, { immediate: true, force: true });
    };
    return () => release.current();
  }, []);

  // Keys and touch can still reach a locked document on some platforms, and
  // scrolling under the overlay would advance the hero's scroll story out of
  // sight, so the page would come back mid-sequence.
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

  // Counted per frame and written straight to the DOM. This runs while the
  // main thread is busy fetching and compiling the scene, and a state update
  // per frame would put React's work in that same queue.
  useEffect(() => {
    if (phase !== "playing") return;
    const start = performance.now();
    let frame = 0;
    let last = start;
    let shown = 0;
    let rate = 0;

    const tick = () => {
      const now = performance.now();
      const step = Math.min((now - last) / 1000, 0.1);
      last = now;
      const scene = readScene();
      const done = scene.settled || (!scene.declared && now - start >= NO_SCENE_GRACE);

      if (done) {
        // Counts the rest of the way at a steady pace, so however far behind
        // the compile left it, the gap is visibly travelled rather than cut —
        // quickened only if that would otherwise hold the page too long.
        if (!rate) rate = Math.max(RATE, (100 - shown) / COUNT_OUT);
        shown = Math.min(100, shown + rate * step);
        if (shown >= 99.5) counted.current = true;
      } else {
        // Approaches the current ceiling without arriving, so the number is
        // always moving even when the milestone it is waiting on is not.
        const climb = 99 * (1 - Math.exp((-(now - start) / CLIMB) * 2.6));
        // Once the scene is mounting it warms up in measurable steps, so the
        // last stretch is earned rather than timed.
        const ceiling = scene.mounting
          ? CEIL[1] + (CEIL[2] - CEIL[1]) * scene.warmup
          : CEIL[scene.declared ? 1 : 0];
        shown = Math.max(shown, Math.min(climb, ceiling));
      }

      if (readout.current) readout.current.textContent = `${Math.min(100, Math.round(shown))}%`;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  // The hero's own heading is uncovered in the same commit that removes this
  // one, with both sitting in the same place.
  useEffect(() => {
    if (phase !== "gone") return;
    document.documentElement.removeAttribute("data-intro-morph");
    release.current();
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
                    style={{ animationDelay: `${140 + index * 18}ms` }}
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
        <span ref={readout} className={`mono ${styles.readout}`}>0%</span>
      </div>
    </div>
  );
}
