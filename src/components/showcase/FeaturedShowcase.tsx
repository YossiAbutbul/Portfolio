"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FEATURED_PROJECTS } from "@content/projects";
import type { Project } from "@/types/project";
import SectionLabel from "@/components/ui/SectionLabel";
import { withBasePath } from "@/lib/env";
import styles from "./FeaturedShowcase.module.css";

export default function FeaturedShowcase() {
  const featured = FEATURED_PROJECTS;
  const [activeIdx, setActiveIdx] = useState(0);
  if (featured.length === 0) return null;

  const active = featured[activeIdx];

  return (
    <section id="showcase" className={styles.section} aria-labelledby="showcase-label">
      <div className="container">
        <div id="showcase-label">
          <SectionLabel index="02">Projects</SectionLabel>
        </div>

        <HeroCard project={active} />

        <TileSlider count={featured.length}>
          {featured.map((p, i) => (
            <SecondaryTile
              key={p.slug}
              project={p}
              index={i}
              active={i === activeIdx}
              onSelect={() => setActiveIdx(i)}
            />
          ))}
        </TileSlider>
      </div>
    </section>
  );
}

/**
 * Horizontal slider: 3 tiles + a peek of the 4th so overflow reads at rest.
 * Two bare chevrons flank the track, vertically centered on the artwork.
 * Touch devices swipe natively.
 */
function TileSlider({ children, count }: { children: ReactNode; count: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  function updateEdges() {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // Tolerate scroll-snap jitter: treat within half a tile of an end as "at" it.
    const first = el.firstElementChild as HTMLElement | null;
    const tol = first ? first.offsetWidth / 2 : 24;
    setAtStart(el.scrollLeft <= tol);
    setAtEnd(el.scrollLeft >= max - tol);
  }

  useEffect(() => {
    updateEdges();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Native smooth scrolling is cancelled by Lenis' per-frame window scroll,
  // and mandatory snap quantizes intermediate values — so tween scrollLeft
  // manually with snap disabled for the duration.
  function tweenTo(el: HTMLDivElement, target: number) {
    cancelAnimationFrame(animRef.current);
    el.style.scrollSnapType = "none";
    const from = el.scrollLeft;
    const start = performance.now();
    const dur = 420;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      el.scrollLeft = from + (target - from) * ease(t);
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        el.style.scrollSnapType = "";
        updateEdges();
      }
    };
    animRef.current = requestAnimationFrame(step);
  }

  /** Tile width + gap — the snap grid everything aligns to. */
  function unitOf(el: HTMLDivElement) {
    const first = el.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    return first ? first.offsetWidth + gap : el.clientWidth;
  }

  function page(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    // Advance by however many tiles fit fully in the viewport (3 desktop,
    // 2 tablet, 1 mobile) so no tile is skipped past unseen.
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    const unit = unitOf(el);
    const per = Math.max(1, Math.floor((el.clientWidth + gap) / unit));
    const max = el.scrollWidth - el.clientWidth;
    // Land on a tile boundary so re-enabling snap after the tween doesn't jump.
    const target = Math.max(0, Math.min(max, Math.round((el.scrollLeft + dir * unit * per) / unit) * unit));
    tweenTo(el, target);
  }

  return (
    <div className={styles.slider} data-at-end={atEnd ? "true" : undefined}>
      <div className={styles.sliderHead}>
        <span className={styles.sliderLabel}>
          All projects · {String(count).padStart(2, "0")}
        </span>
        <span className={styles.sliderRule} aria-hidden="true" />
      </div>
      <div className={styles.viewport}>
        <div className={styles.tiles} ref={trackRef}>
          {children}
        </div>
        <div className={styles.edgeFade} aria-hidden="true" />
        <button
          type="button"
          className={`${styles.navBtn} ${styles.navPrev}`}
          onClick={() => page(-1)}
          disabled={atStart}
          aria-label="Previous projects"
        >
          <Chevron dir="left" />
        </button>
        <button
          type="button"
          className={`${styles.navBtn} ${styles.navNext}`}
          onClick={() => page(1)}
          disabled={atEnd}
          aria-label="More projects"
        >
          <Chevron dir="right" />
        </button>
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      className={styles.arrowIcon}
      viewBox="0 0 12 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === "left" ? <path d="M9 2 2 12l7 10" /> : <path d="m3 2 7 10-7 10" />}
    </svg>
  );
}

function HeroCard({ project }: { project: Project }) {
  return (
    <article className={styles.hero} key={project.slug}>
      <div className={styles.heroMedia}>
        <Media project={project} contain playing />
        <span className={styles.heroBadge}>FEATURED</span>
      </div>

      <div className={styles.heroCopy}>
        <h3 className={styles.heroTitle}>{project.title}</h3>
        <p className={styles.heroSummary}>{project.summary}</p>

        <dl className={styles.heroMeta}>
          <div>
            <dt>Stack</dt>
            <dd>{project.stack.join(" · ")}</dd>
          </div>
        </dl>

        <div className={styles.heroActions}>
          {(() => {
            const liveDemo = project.links.find((l) => /live/i.test(l.label));
            const github = project.links.find((l) => /github/i.test(l.label));
            const rest = project.links.filter((l) => l !== liveDemo && l !== github);
            return (
              <>
                {liveDemo && (
                  <a
                    href={liveDemo.href}
                    className={styles.btnPrimary}
                    target={liveDemo.href.startsWith("http") ? "_blank" : undefined}
                    rel={liveDemo.href.startsWith("http") ? "noreferrer noopener" : undefined}
                  >
                    {liveDemo.label} ↗
                  </a>
                )}
                {github && (
                  <a
                    key={github.href}
                    href={github.href}
                    className={styles.btnGhost}
                    target={github.href.startsWith("http") ? "_blank" : undefined}
                    rel={github.href.startsWith("http") ? "noreferrer noopener" : undefined}
                  >
                    {github.label} ↗
                  </a>
                )}
                {!project.noCase && (
                  <Link href={`/projects/${project.slug}/`} className={styles.btnGhost}>
                    Details →
                  </Link>
                )}
                {rest.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className={styles.btnGhost}
                    target={l.href.startsWith("http") ? "_blank" : undefined}
                    rel={l.href.startsWith("http") ? "noreferrer noopener" : undefined}
                  >
                    {l.label} ↗
                  </a>
                ))}
              </>
            );
          })()}
        </div>
      </div>
    </article>
  );
}

function SecondaryTile({
  project,
  index,
  active,
  onSelect,
}: {
  project: Project;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.tile} ${active ? styles.tileActive : ""}`}
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`Show ${project.title}`}
    >
      <div className={styles.tileMedia}>
        <Media project={project} contain playing={false} />
      </div>
      <div className={styles.tileCopy}>
        <span className={styles.tileIdx}>{String(index + 1).padStart(2, "0")}</span>
        <span className={styles.tileTitle}>{project.title}</span>
      </div>
    </button>
  );
}

function Media({ project, contain, playing = false }: { project: Project; contain?: boolean; playing?: boolean }) {
  const fit = contain ? styles.mediaContain : styles.mediaCover;
  if (project.video) {
    return (
      <VideoFrame
        src={withBasePath(project.video)}
        poster={project.images?.[0]?.src ? withBasePath(project.images[0].src) : undefined}
        className={`${styles.mediaImg} ${fit}`}
        playing={playing}
      />
    );
  }
  const img = project.images?.[0];
  if (!img) {
    return (
      <div className={styles.mediaPlaceholder}>
        <span className={styles.placeholderLabel}>{project.title}</span>
      </div>
    );
  }
  return (
    <img
      src={withBasePath(img.src)}
      alt={img.alt}
      loading="lazy"
      className={`${styles.mediaImg} ${fit}`}
    />
  );
}

function VideoFrame({
  src,
  poster,
  className,
  playing,
}: {
  src: string;
  poster?: string;
  className: string;
  playing: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);

  // Track viewport visibility so we never play a video that's offscreen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const shouldPlay = playing && inView;

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (shouldPlay) {
      v.play().catch(() => {/* autoplay blocked is fine */});
    } else {
      v.pause();
      // Seek slightly past 0 so the browser decodes + paints a cover frame
      // (currentTime = 0 on a paused video can render nothing).
      try {
        v.currentTime = 0.01;
      } catch {}
    }
  }, [shouldPlay]);

  function handleLoadedMetadata() {
    const v = ref.current;
    if (!v) return;
    if (!shouldPlay) {
      try { v.currentTime = 0.01; } catch {}
    }
  }

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="auto"
      onLoadedMetadata={handleLoadedMetadata}
    />
  );
}
