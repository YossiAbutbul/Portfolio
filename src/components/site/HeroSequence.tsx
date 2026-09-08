"use client";

import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { signalStory } from "./signal-story";
import { declareScene, settleScene } from "@/lib/appReady";
import styles from "./HeroSequence.module.css";

const loadSignalCore = () => import("./SignalCore");
const SignalCore = lazy(loadSignalCore);

export default function HeroSequence() {
  const section = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const chipCopy = useRef<HTMLDivElement>(null);
  const graphCopy = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const seek = useRef<((progress: number) => void) | null>(null);
  // The server and first client frame use the same layout. Never flash the
  // static three-stage illustration while the WebGL bundle is loading.
  const [animated, setAnimated] = useState(true);
  const [sceneEnabled, setSceneEnabled] = useState(false);
  const showStatic = useCallback(() => setAnimated(false), []);

  // The intro loader holds the site until this hero says it is ready, so it
  // has to know the hero is coming before its grace period runs out.
  useLayoutEffect(() => { declareScene(); }, []);

  // The static drawing needs no warm-up, so it releases the loader at once.
  useLayoutEffect(() => { if (!animated) settleScene(); }, [animated]);

  useLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setAnimated(!reduced.matches);
    change();
    reduced.addEventListener("change", change);
    return () => reduced.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    if (!animated) {
      setSceneEnabled(false);
      return;
    }
    let cancelled = false;
    let timeout = 0;
    let idle = 0;
    const win = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const enable = () => {
      if (!cancelled) setSceneEnabled(true);
    };
    const warmUp = () => {
      if (win.requestIdleCallback) idle = win.requestIdleCallback(enable, { timeout: 650 });
      else timeout = window.setTimeout(enable, 350);
    };
    const start = () => {
      if (cancelled) return;
      void loadSignalCore();
      timeout = window.setTimeout(warmUp, 40);
    };
    const hurry = () => {
      window.clearTimeout(timeout);
      if (idle) win.cancelIdleCallback?.(idle);
      enable();
    };
    const frame = requestAnimationFrame(start);
    window.addEventListener("scroll", hurry, { passive: true, once: true });
    window.addEventListener("pointerdown", hurry, { passive: true, once: true });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      if (idle) win.cancelIdleCallback?.(idle);
      window.removeEventListener("scroll", hurry);
      window.removeEventListener("pointerdown", hurry);
    };
  }, [animated]);

  useLayoutEffect(() => {
    if (!animated || !section.current) return;
    const root = section.current;
    let frame = 0;
    let lastFrame = 0;
    let initialized = false;
    function update(now = performance.now()) {
      frame = 0;
      const viewport = root.firstElementChild as HTMLElement;
      const bounds = root.getBoundingClientRect();
      const distance = Math.max(1, root.offsetHeight - viewport.offsetHeight);
      const target = Math.max(0, Math.min(1, -bounds.top / distance));
      const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 1 / 60;
      lastFrame = now;
      // Ease wheel/trackpad steps without delaying anchor jumps or restoration.
      if (!initialized || Math.abs(target - progress.current) > 0.35 || target === 0 || target === 1) {
        progress.current = target;
      } else {
        progress.current += (target - progress.current) * (1 - Math.exp(-dt * 15));
      }
      initialized = true;
      const state = signalStory(progress.current);
      root.style.setProperty("--scene-focus", String(state.focus));
      const panels = [
        [intro.current, state.introOpacity],
        [chipCopy.current, state.chipOpacity],
        [graphCopy.current, state.graphOpacity],
      ] as const;
      for (const [panel, opacity] of panels) {
        if (!panel) continue;
        panel.style.opacity = String(opacity);
        panel.style.transform = `translateY(${(1 - opacity) * 18}px)`;
        panel.style.visibility = opacity < 0.01 ? "hidden" : "visible";
        panel.inert = opacity < 0.1;
        panel.setAttribute("aria-hidden", String(opacity < 0.1));
      }
      seek.current?.(progress.current);
      if (Math.abs(target - progress.current) > 0.00005) frame = requestAnimationFrame(update);
      else lastFrame = 0;
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    observer.observe(root.firstElementChild!);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("pageshow", schedule);
    update();
    void import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => ScrollTrigger.refresh());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pageshow", schedule);
      root.style.removeProperty("--scene-focus");
      for (const panel of [intro.current, chipCopy.current, graphCopy.current]) {
        panel?.removeAttribute("style");
        panel?.removeAttribute("aria-hidden");
        if (panel) panel.inert = false;
      }
    };
  }, [animated]);

  return (
    <section ref={section} id="hero" className={styles.sequence} data-animated={animated} aria-labelledby="hero-name">
      <div className={styles.viewport}>
        <div className={styles.layout}>
          <div className={styles.copy}>
            <div ref={intro} className={styles.intro}>
              <h1 id="hero-name" className={styles.name}>Yossi<br />Abutbul</h1>
              <p className={styles.role}>Building software where signals meet code.</p>
              <p className={styles.bio}>BSc Computer Science. RF automation and AI.</p>
              {!animated && <StageDrawing stage="signal" />}
            </div>
            <div ref={chipCopy} className={styles.chapter}>
              <h2>Software that<br />touches hardware.</h2>
              <p>Instrument drivers, test sequencers, and the plumbing that keeps a measurement repeatable.</p>
              {!animated && <StageDrawing stage="chip" />}
            </div>
            <div ref={graphCopy} className={styles.chapter}>
              <h2>Data someone<br />can act on.</h2>
              <p>Raw captures become plots, reports, and tools the next person can run without me.</p>
              <a className={styles.projectLink} href="#work">See the projects</a>
              {!animated && <StageDrawing stage="graph" />}
            </div>
          </div>
          {animated && (
            <div className={styles.visual}>
              {sceneEnabled && (
                <Suspense fallback={null}>
                  <SignalCore progress={progress} seek={seek} onUnavailable={showStatic} onReady={settleScene} />
                </Suspense>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StageDrawing({ stage }: { stage: "signal" | "chip" | "graph" }) {
  return (
    <svg className={styles.drawing} viewBox="0 0 500 250" fill="none" role="img" aria-label={
      stage === "signal" ? "An analog sine wave" : stage === "chip" ? "The layers and circuitry inside a processor" : "A waveform plotted as individual measurements"
    }>
      {stage === "signal" && <path d="M30 125C52 125 52 60 74 60S96 190 118 190S140 60 162 60S184 190 206 190S228 60 250 60S272 190 294 190S316 60 338 60S360 190 382 190S404 125 470 125" stroke="#ff7a42" strokeWidth="3" />}
      {stage === "chip" && <g transform="translate(250 125) rotate(-18)">
        <rect x="-90" y="-60" width="180" height="145" rx="6" fill="#24292f" stroke="#687985" />
        <rect x="-74" y="-90" width="148" height="132" rx="5" fill="#a9b7c3" fillOpacity=".4" stroke="#cbd5dd" />
        <rect x="-42" y="-27" width="84" height="70" fill="#15191d" stroke="#ff7a42" />
        <path d="M-90 10H-42M42 10H90M0 43V85" stroke="#ff7a42" strokeWidth="2" />
      </g>}
      {stage === "graph" && <>
        <path d="M45 35V210H460M45 125H460" stroke="#687985" />
        <path d="M55 125C100 125 100 60 145 60S190 190 235 190S280 65 325 65S370 125 445 125" stroke="#ff7a42" strokeWidth="3" />
        {[[55,125],[145,60],[235,190],[325,65],[445,125]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="5" fill="#cbd5dd" />)}
      </>}
    </svg>
  );
}
