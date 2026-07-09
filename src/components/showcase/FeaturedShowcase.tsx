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
  if (featured.length === 0) return null;

  const active = featured[0];

  return (
    <section id="showcase" className={styles.section} aria-labelledby="showcase-label">
      <div className="container">
        <div id="showcase-label">
          <SectionLabel index="02">Projects</SectionLabel>
        </div>

        <HeroCard project={active} />

        <TileSlider>
          {featured.map((p, i) => (
            <SecondaryTile key={p.slug} project={p} index={i + 1} />
          ))}
        </TileSlider>
      </div>
    </section>
  );
}

/**
 * Horizontal slider that shows ~3 tiles at a time. Prev/next arrows stay
 * faded-in and brighten on hover; each click pages the track by roughly one
 * viewport width. Arrows dim at the track ends. Mobile keeps native swipe.
 */
function TileSlider({ children }: { children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
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
    };
  }, []);

  function page(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    // Advance a full view — 3 tiles + the two gaps between them.
    const first = el.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    const step = first ? first.offsetWidth * 3 + gap * 3 : el.clientWidth;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  return (
    <div className={styles.slider}>
      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowPrev}`}
        onClick={() => page(-1)}
        disabled={atStart}
        aria-label="Previous projects"
      >
        <Chevron dir="left" />
      </button>
      <div className={styles.tiles} ref={trackRef}>
        {children}
      </div>
      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowNext}`}
        onClick={() => page(1)}
        disabled={atEnd}
        aria-label="More projects"
      >
        <Chevron dir="right" />
      </button>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      className={styles.arrowIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === "left" ? <path d="M15 5 8 12l7 7" /> : <path d="M9 5l7 7-7 7" />}
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

function SecondaryTile({ project }: { project: Project; index: number }) {
  const inner = (
    <>
      <div className={styles.tileMedia}>
        <Media project={project} contain playing={false} />
      </div>
      <div className={styles.tileCopy}>
        <span className={styles.tileTitle}>{project.title}</span>
      </div>
    </>
  );

  // Tiles link out instead of swapping the hero. Case-study page when it
  // exists, otherwise the project's first external link.
  if (project.noCase) {
    const href = project.links[0]?.href ?? "#";
    return (
      <a
        className={styles.tile}
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer noopener" : undefined}
        aria-label={project.title}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link className={styles.tile} href={`/projects/${project.slug}/`} aria-label={project.title}>
      {inner}
    </Link>
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
