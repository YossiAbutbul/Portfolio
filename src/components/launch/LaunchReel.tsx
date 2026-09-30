"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Project } from "@/types/project";
import { withBasePath } from "@/lib/env";
import styles from "./LaunchReel.module.css";

/** One card colour per project, from the set palette, and the ink that reads on it. */
const CARDS = [
  { bg: "var(--sand)", ink: "var(--ink-dark)" },
  { bg: "var(--cork)", ink: "var(--ink-dark)" },
  { bg: "var(--olive)", ink: "var(--cream)" },
  { bg: "var(--red)", ink: "var(--cream)" },
  { bg: "var(--mat)", ink: "var(--cream)" },
  { bg: "var(--cream)", ink: "var(--ink-dark)" },
];

const PREVIEWS: Record<string, string> = {
  "test-console": "/projects/test-console/screenshot.png",
  oplanner: "/projects/oplanner/poster.jpg",
  "pipeline-cpu": "/projects/pipeline-cpu/poster.jpg",
  "current-logger": "/projects/current-logger/screenshot.png",
  algorithmx: "/projects/algorithmx/screenshot.png",
  "toast-turn": "/projects/toast-turn/cover.png",
};

/**
 * The projects, as a sideways reel: vertical scroll through a pinned section moves the cards across,
 * and the card nearest the middle is in focus. Reduced motion gets a plain vertical list.
 */
export default function LaunchReel({ projects }: { projects: Project[] }) {
  const section = useRef<HTMLElement>(null);
  const reel = useRef<HTMLOListElement>(null);
  const count = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = section.current, track = reel.current;
    if (!root || !track) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    function update() {
      frame = 0;
      if (!root || !track) return;
      const cards = [...track.children] as HTMLElement[];
      if (reduce.matches) {
        track.style.transform = ""; track.style.paddingLeft = "";
        cards.forEach((card) => card.removeAttribute("data-far"));
        return;
      }
      const r = root.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      const width = cards[0]?.offsetWidth ?? 0;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      // First card starts centred, last card ends centred.
      track.style.paddingLeft = `${(innerWidth - width) / 2}px`;
      track.style.transform = `translate3d(${-progress * (cards.length - 1) * (width + gap)}px, 0, 0)`;
      const focus = Math.round(progress * (cards.length - 1));
      cards.forEach((card, i) => {
        const far = i !== focus;
        card.toggleAttribute("data-far", far);
        // Off-focus cards stay reachable by keyboard: focusing one scrolls it into the middle.
        card.setAttribute("aria-current", String(!far));
      });
      if (count.current) count.current.textContent = `${String(focus + 1).padStart(2, "0")}/${String(cards.length).padStart(2, "0")}`;
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    // Keyboard users tabbing into a card get it brought to the middle.
    const onFocus = (event: FocusEvent) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>("[data-card]");
      if (!card || reduce.matches) return;
      const i = Number(card.dataset.card), cards = track.children.length;
      const r = root.getBoundingClientRect();
      const top = window.scrollY + r.top + (i / Math.max(1, cards - 1)) * (r.height - innerHeight);
      window.__lenis ? window.__lenis.scrollTo(top, { immediate: true }) : window.scrollTo(0, top);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduce.addEventListener("change", schedule);
    track.addEventListener("focusin", onFocus);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduce.removeEventListener("change", schedule);
      track.removeEventListener("focusin", onFocus);
    };
  }, []);

  return (
    <section ref={section} className={styles.pin} id="work" aria-labelledby="work-title" style={{ ["--cards" as string]: projects.length }}>
      <div className={styles.frame}>
        <div className={styles.head}>
          <span className={styles.cap}>Features</span>
          <h2 id="work-title">Six things it has<br />already shipped</h2>
        </div>
        <ol ref={reel} className={styles.reel}>
          {projects.map((project, i) => {
            const card = CARDS[i % CARDS.length];
            const hasCase = !project.noCase;
            const external = project.links.find((l) => l.label === "Live") ?? project.links[0];
            const preview = PREVIEWS[project.slug];
            const alt = project.images?.find((image) => image.src === preview)?.alt ?? `${project.title} interface`;
            return (
              <li key={project.slug} className={styles.card} data-card={i} style={{ background: card.bg, color: card.ink }}>
                <div className={styles.txt}>
                  <div>
                    <span className={styles.cap}>{String(i + 1).padStart(2, "0")} · {project.year} · {project.role}</span>
                    <h3>{project.title}</h3>
                    <p>{project.summary}</p>
                  </div>
                  <div>
                    {project.metric && (
                      <p className={styles.metric}>
                        <s>{project.metric.before}</s> <span aria-hidden="true">→</span>
                        <span className={styles.srOnly}> to </span> {project.metric.after}
                      </p>
                    )}
                    <p className={styles.stack}>{project.stack.slice(0, 4).join(" · ")}</p>
                    <div className={styles.links}>
                      {hasCase && <Link href={`/projects/${project.slug}`}>Case study</Link>}
                      {external && (
                        <a href={external.href} target="_blank" rel="noreferrer">
                          {external.label === "Live" ? "Open live" : "View code"} <span aria-hidden="true">↗</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                {preview && (
                  <div className={styles.pic}>
                    <img src={withBasePath(preview)} alt={alt} width={1280} height={720} loading="lazy" decoding="async" />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <span ref={count} className={styles.count} aria-hidden="true">01/{String(projects.length).padStart(2, "0")}</span>
      </div>
    </section>
  );
}
