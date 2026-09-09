"use client";

import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { signalStory } from "./signal-story";
import { declareScene, mountingScene, settleScene, warmingScene } from "@/lib/appReady";
import styles from "./HeroSequence.module.css";

const loadSignalCore = () => import("./SignalCore");
const SignalCore = lazy(loadSignalCore);

export default function HeroSequence() {
  const section = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const chipCopy = useRef<HTMLDivElement>(null);
  const codeCopy = useRef<HTMLDivElement>(null);
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

  // The intro reads this as the point the WebGL module landed.
  useLayoutEffect(() => { if (sceneEnabled) mountingScene(); }, [sceneEnabled]);

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
      // The scene trails the page by about a tenth of a second, which is what
      // gives the sculpture its weight; much tighter and it snaps between poses.
      if (!initialized || Math.abs(target - progress.current) > 0.35 || target === 0 || target === 1) {
        progress.current = target;
      } else {
        progress.current += (target - progress.current) * (1 - Math.exp(-dt * 11));
      }
      initialized = true;
      const state = signalStory(progress.current);
      root.style.setProperty("--scene-focus", String(state.focus));
      const panels = [
        [intro.current, state.introOpacity],
        [chipCopy.current, state.chipOpacity],
        [codeCopy.current, state.codeOpacity],
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
      for (const panel of [intro.current, chipCopy.current, codeCopy.current, graphCopy.current]) {
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
              <p className={styles.role} data-hero-line="role">Building software where signals meet code.</p>
              <p className={styles.bio} data-hero-line="bio">BSc Computer Science. RF automation and AI.</p>
              {!animated && <StageDrawing stage="signal" />}
            </div>
            <div ref={chipCopy} className={styles.chapter}>
              <h2>Software that<br />touches hardware.</h2>
              <p>Instrument drivers, test sequencers, and the plumbing that keeps a measurement repeatable.</p>
              {!animated && <StageDrawing stage="chip" />}
            </div>
            <div ref={codeCopy} className={styles.chapter}>
              <h2>Signal in,<br />code out.</h2>
              <p>A capture lands on the bench machine, and handling it becomes a routine that runs the same way tomorrow.</p>
              {!animated && <StageDrawing stage="code" />}
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
                  <SignalCore progress={progress} seek={seek} onUnavailable={showStatic} onWarming={warmingScene} onReady={settleScene} />
                </Suspense>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Indent, then the tokens on that line: 0 plain, 1 keyword, 2 string, 3 comment. */
const CODE_LINES: [indent: number, tokens: [width: number, kind: number][]][] = [
  [0, [[150, 3]]],
  [0, [[36, 1], [70, 0], [26, 0]]],
  [1, [[56, 0], [44, 1], [32, 0]]],
  [1, [[80, 0], [30, 2]]],
  [2, [[46, 1], [64, 0]]],
  [2, [[56, 0], [34, 2], [48, 0]]],
  [1, [[40, 1], [74, 0]]],
  [0, [[32, 1], [54, 0], [56, 2]]],
  [1, [[62, 0], [46, 1]]],
];

const CODE_INKS = ["#93a3af", "#ff7a42", "#c0a173", "#4b5862"];

function StageDrawing({ stage }: { stage: "signal" | "chip" | "code" | "graph" }) {
  return (
    <svg className={styles.drawing} viewBox="0 0 500 250" fill="none" role="img" aria-label={
      stage === "signal" ? "An analog sine wave"
        : stage === "chip" ? "The layers and circuitry inside a processor"
          : stage === "code" ? "A screen with the signal handling written out line by line"
            : "A waveform plotted as individual measurements"
    }>
      {stage === "signal" && <path d="M30 125C52 125 52 60 74 60S96 190 118 190S140 60 162 60S184 190 206 190S228 60 250 60S272 190 294 190S316 60 338 60S360 190 382 190S404 125 470 125" stroke="#ff7a42" strokeWidth="3" />}
      {stage === "chip" && <g transform="translate(250 125) rotate(-18)">
        <rect x="-90" y="-60" width="180" height="145" rx="6" fill="#24292f" stroke="#687985" />
        <rect x="-74" y="-90" width="148" height="132" rx="5" fill="#a9b7c3" fillOpacity=".4" stroke="#cbd5dd" />
        <rect x="-42" y="-27" width="84" height="70" fill="#15191d" stroke="#ff7a42" />
        <path d="M-90 10H-42M42 10H90M0 43V85" stroke="#ff7a42" strokeWidth="2" />
      </g>}
      {stage === "code" && <g>
        <rect x="62" y="18" width="376" height="186" rx="7" fill="#24292f" stroke="#687985" />
        <rect x="72" y="28" width="356" height="160" fill="#10161a" />
        <path d="M82 44H418M104 52V180" stroke="#687985" strokeOpacity=".5" />
        <rect x="82" y="34" width="30" height="4" fill="#ff7a42" />
        <rect x="118" y="34" width="22" height="4" fill="#4b5862" />
        <rect x="416" y="52" width="4" height="42" fill="#4b5862" />
        {CODE_LINES.map(([indent, runs], row) => {
          let x = 112 + indent * 14;
          return (
            <g key={row}>
              <rect x="86" y={57 + row * 15} width="9" height="3" fill="#4b5862" />
              {runs.map(([width, kind], index) => {
                const bar = <rect key={index} x={x} y={54 + row * 15} width={width} height="6" rx="2" fill={CODE_INKS[kind]} />;
                x += width + 8;
                return bar;
              })}
              {row === CODE_LINES.length - 1 && <rect x={x - 4} y={52 + row * 15} width="3" height="10" fill="#ff7a42" />}
            </g>
          );
        })}
        <circle cx="418" cy="196" r="3" fill="#ff7a42" />
        <rect x="234" y="204" width="32" height="22" fill="#24292f" stroke="#687985" />
        <ellipse cx="250" cy="231" rx="60" ry="8" fill="#24292f" stroke="#687985" />
      </g>}
      {stage === "graph" && <>
        <path d="M45 35V210H460M45 125H460" stroke="#687985" />
        <path d="M55 125C100 125 100 60 145 60S190 190 235 190S280 65 325 65S370 125 445 125" stroke="#ff7a42" strokeWidth="3" />
        {[[55,125],[145,60],[235,190],[325,65],[445,125]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="5" fill="#cbd5dd" />)}
      </>}
    </svg>
  );
}
