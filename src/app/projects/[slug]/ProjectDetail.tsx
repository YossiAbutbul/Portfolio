"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FEATURED_PROJECTS } from "@content/projects";
import { withBasePath } from "@/lib/env";
import type { Project } from "@/types/project";
import styles from "./page.module.css";

export default function ProjectDetail({ project }: { project: Project }) {
  const liveDemo = project.links.find((l) => /live/i.test(l.label));
  const github = project.links.find((l) => /github/i.test(l.label));
  const otherLinks = project.links.filter((l) => l !== liveDemo && l !== github);

  const featuredList = FEATURED_PROJECTS.filter((p) => !p.noCase);
  const currentIdx = featuredList.findIndex((p) => p.slug === project.slug);
  const prevProject = currentIdx > 0 ? featuredList[currentIdx - 1] : null;
  const nextProject = currentIdx < featuredList.length - 1 ? featuredList[currentIdx + 1] : null;

  return (
    <article className={styles.page}>
      <div className="container">

        {/* ── Header ── */}
        <header className={styles.header}>
          {project.wip && (
            <div className={styles.headerMeta}>
              <span className={styles.wipBadge}>WIP</span>
            </div>
          )}
          <h1 className={styles.title}>{project.title}</h1>
        </header>

        {/* ── Full-width media ── */}
        <div className={styles.mediaWide}>
          <ProjectMedia project={project} />
        </div>

        {/* ── Body: overview + sticky sidebar ── */}
        <div className={styles.body}>
          <div className={styles.content}>
            <section className={styles.section}>
              <h2 className={styles.sectionHeading}>Overview</h2>
              {(project.overview ?? [project.summary]).map((p, i) => (
                <p key={i} className={styles.paragraph}>{p}</p>
              ))}
            </section>

            {project.highlights && project.highlights.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionHeading}>Highlights</h2>
                <ul className={styles.highlightList}>
                  {project.highlights.map((h, i) => (
                    <li key={i} className={styles.highlightItem}>
                      <span className={styles.bullet} aria-hidden="true">▸</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className={styles.sidebar}>
            <div className={styles.stackSection}>
              <span className={styles.stackLabel}>Stack</span>
              <div className={styles.stackPills}>
                {project.stack.map((s) => (
                  <span key={s} className={styles.pill}>{s}</span>
                ))}
              </div>
            </div>

            <div className={styles.linkGroup}>
              {liveDemo && (
                <a href={liveDemo.href} className={styles.btnPrimary} target="_blank" rel="noreferrer noopener">
                  {liveDemo.label} ↗
                </a>
              )}
              {github && (
                <a href={github.href} className={styles.btnGhost} target="_blank" rel="noreferrer noopener">
                  {github.label} ↗
                </a>
              )}
              {otherLinks.map((l) => (
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
            </div>
          </aside>
        </div>

        {/* ── Project nav ── */}
        {(prevProject || nextProject) && (
          <nav className={styles.projectNav} aria-label="Other featured projects">
            <div className={styles.navSlot}>
              {prevProject && (
                <Link href={`/projects/${prevProject.slug}/`} className={styles.navLink}>
                  <span className={styles.navDir}>← Prev</span>
                  <span className={styles.navTitle}>{prevProject.title}</span>
                </Link>
              )}
            </div>
            <div className={`${styles.navSlot} ${styles.navSlotRight}`}>
              {nextProject && (
                <Link href={`/projects/${nextProject.slug}/`} className={styles.navLink}>
                  <span className={styles.navDir}>Next →</span>
                  <span className={styles.navTitle}>{nextProject.title}</span>
                </Link>
              )}
            </div>
          </nav>
        )}

      </div>
    </article>
  );
}

function ProjectMedia({ project }: { project: Project }) {
  const images = project.images ?? [];

  if (project.video) {
    return (
      <div className={styles.mediaWrap}>
        <VideoPlayer
          src={withBasePath(project.video)}
          poster={images[0]?.src ? withBasePath(images[0].src) : undefined}
        />
      </div>
    );
  }

  if (images.length > 0) {
    const active = images[0];
    return (
      <div className={styles.mediaWrap}>
        <div className={styles.imageFrame}>
          <img
            src={withBasePath(active.src)}
            alt={active.alt}
            loading="lazy"
            className={styles.mainImage}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mediaWrap}>
      <div className={styles.mediaPlaceholder}>
        <span className={styles.placeholderLabel}>{project.title}</span>
      </div>
    </div>
  );
}

function VideoPlayer({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { for (const e of entries) setInView(e.isIntersecting); },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (inView) {
      v.play().catch(() => {});
    } else {
      v.pause();
      try { v.currentTime = 0.01; } catch {}
    }
  }, [inView]);

  return (
    <div className={styles.videoFrame}>
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="auto"
        className={styles.video}
        onLoadedMetadata={() => {
          const v = ref.current;
          if (v && !inView) { try { v.currentTime = 0.01; } catch {} }
        }}
      />
    </div>
  );
}
