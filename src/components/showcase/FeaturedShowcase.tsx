"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const others = featured.map((p, i) => ({ p, i })).filter((x) => x.i !== activeIdx);

  return (
    <section id="showcase" className={styles.section} aria-labelledby="showcase-label">
      <div className="container">
        <div id="showcase-label">
          <SectionLabel index="02">Projects</SectionLabel>
        </div>

        <HeroCard project={active} />

        <div className={styles.tiles}>
          {others.map(({ p, i }) => (
            <SecondaryTile
              key={p.slug}
              project={p}
              index={i + 1}
              onSelect={() => setActiveIdx(i)}
            />
          ))}
        </div>
      </div>
    </section>
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
            const others = project.links.filter((l) => l !== liveDemo);
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
                {!project.noCase && (
                  <Link href={`/projects/${project.slug}/`} className={styles.btnGhost}>
                    Case study →
                  </Link>
                )}
                {others.map((l) => (
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
  onSelect,
}: {
  project: Project;
  index: number;
  onSelect: () => void;
}) {
  return (
    <button type="button" className={styles.tile} onClick={onSelect} aria-label={`Show ${project.title}`}>
      <div className={styles.tileMedia}>
        <Media project={project} contain playing={false} />
      </div>
      <div className={styles.tileCopy}>
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
