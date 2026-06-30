"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CHAPTERS } from "./chapters";
import CodeStream from "./CodeStream";
import SignalStream from "./SignalStream";
import styles from "./TriptychExperience.module.css";

const Wave3D = dynamic(() => import("./Wave3D"), { ssr: false });

export default function TriptychExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0); // 0..1 across whole experience
  const [chapterIdx, setChapterIdx] = useState(0);
  const [progressPct, setProgressPct] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;

    function update() {
      const rect = root!.getBoundingClientRect();
      const total = root!.offsetHeight - window.innerHeight;
      const scrolled = Math.max(0, -rect.top);
      const p = total > 0 ? Math.max(0, Math.min(1, scrolled / total)) : 0;
      progressRef.current = p;
      setProgressPct(p);
      // Chapter index from progress
      const n = CHAPTERS.length;
      const ci = Math.min(n - 1, Math.floor(p * n));
      setChapterIdx(ci);
    }

    // Poll via rAF — Lenis' immediate scrolls don't always dispatch a native scroll event,
    // and Triptych needs to track sub-pixel progress smoothly regardless.
    function loop() {
      update();
      raf = requestAnimationFrame(loop);
    }
    update();
    raf = requestAnimationFrame(loop);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
    };
  }, []);

  const chapter = CHAPTERS[chapterIdx];

  return (
    <div ref={rootRef} className={styles.root} style={{ height: `${CHAPTERS.length * 100}vh` }}>
      <div className={styles.viewport}>
        {/* Top status bar */}
        <header className={styles.statusBar}>
          <span className={styles.statusGroup}>
            <span className={styles.statusDot} />
            <span>portfolio.run</span>
          </span>
          <span className={styles.statusGroup}>
            <span className={styles.statusKey}>CH</span>
            <span className={styles.statusVal}>{chapter.index} / {(CHAPTERS.length - 1).toString().padStart(2, "0")}</span>
          </span>
          <span className={styles.statusGroup}>
            <span className={styles.statusKey}>PROGRESS</span>
            <span className={styles.statusVal}>{Math.round(progressPct * 100)}%</span>
            <span className={styles.progressTrack}>
              <span className={styles.progressFill} style={{ width: `${progressPct * 100}%` }} />
            </span>
          </span>
          <span className={styles.statusGroup}>
            <span className={styles.statusKey}>UPTIME</span>
            <span className={styles.statusVal}>5y · 0d</span>
          </span>
        </header>

        {/* Triptych grid */}
        <main className={styles.grid}>
          <div className={styles.laneLeft}>
            <CodeStream chapter={chapter} />
          </div>

          <section className={styles.center} aria-live="polite">
            <div className={styles.center3d}>
              <Wave3D progress={progressRef} />
            </div>
            <div className={styles.centerOverlay}>
              <p className={styles.kicker}>{chapter.kicker}</p>
              <h2 className={styles.title}>{chapter.title}</h2>
              <p className={styles.body}>{chapter.body}</p>
              {chapter.cta && (
                chapter.cta.external ? (
                  <a className={styles.cta} href={chapter.cta.href} target="_blank" rel="noreferrer noopener">
                    {chapter.cta.label} <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <a className={styles.cta} href={chapter.cta.href}>
                    {chapter.cta.label}
                  </a>
                )
              )}
            </div>
          </section>

          <div className={styles.laneRight}>
            <SignalStream chapter={chapter} />
          </div>
        </main>

        {/* Chapter rail (bottom) */}
        <nav className={styles.rail} aria-label="Chapters">
          {CHAPTERS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.railItem} ${i === chapterIdx ? styles.railItemActive : ""}`}
              onClick={() => {
                const root = rootRef.current;
                if (!root) return;
                const total = root.offsetHeight - window.innerHeight;
                const targetY = root.offsetTop + (i / CHAPTERS.length) * total + 4;
                if (window.__lenis) window.__lenis.scrollTo(targetY, { duration: 1.2 });
                else window.scrollTo({ top: targetY, behavior: "smooth" });
              }}
              aria-label={`Jump to chapter ${c.index} — ${c.title}`}
            >
              <span className={styles.railIdx}>{c.index}</span>
              <span className={styles.railTitle}>{c.title}</span>
            </button>
          ))}
        </nav>

        {/* Project peaks footer (always available beneath experience) */}
      </div>

      {/* Projects + Contact appended below the pinned experience for SEO + crawlability */}
      <div className={styles.tail}>
        <CapturesList />
      </div>
    </div>
  );
}

function CapturesList() {
  /* Lightweight inline list — full bento removed to honour "not stacked sections" brief. */
  return null;
}
