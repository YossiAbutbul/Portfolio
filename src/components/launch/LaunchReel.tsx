"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Project } from "@/types/project";
import { withBasePath } from "@/lib/env";
import styles from "./LaunchReel.module.css";

const PREVIEWS: Record<string, string> = {
  "test-console": "/projects/test-console/screenshot.png",
  oplanner: "/projects/oplanner/poster.jpg",
  "pipeline-cpu": "/projects/pipeline-cpu/poster.jpg",
  "current-logger": "/projects/current-logger/screenshot.png",
  algorithmx: "/projects/algorithmx/screenshot.png",
  "toast-turn": "/projects/toast-turn/cover.png",
};

/* Silent loops of the apps working, each with a poster from its own first frames and its true size.
   OPlanner and Pipeline CPU are screen recordings of the real apps; AlgorithmX and ToastTurn were
   recorded from the live sites. Test Console and Current Logger need their lab hardware, so they
   keep a slow pan over the screenshot. */
const DEMOS: Record<string, { src: string; poster: string; w: number; h: number }> = {
  oplanner: { src: "/projects/oplanner/demo.mp4", poster: "/projects/oplanner/demo-poster.jpg", w: 1920, h: 1112 },
  "pipeline-cpu": { src: "/projects/pipeline-cpu/demo.mp4", poster: "/projects/pipeline-cpu/demo-poster.jpg", w: 1920, h: 1080 },
  algorithmx: { src: "/projects/algorithmx/demo.mp4", poster: "/projects/algorithmx/demo-poster.jpg", w: 1920, h: 1080 },
  "toast-turn": { src: "/projects/toast-turn/demo.mp4", poster: "/projects/toast-turn/demo-poster.jpg", w: 1920, h: 1080 },
};

/** A project's name, what it is, its result, and where to go next. The label form (beside the strip)
 *  is just the number, the name and the links; the full form adds the summary and the result. */
function Caption({ project, i, id, label }: { project: Project; i: number; id?: string; label?: boolean }) {
  const hasCase = !project.noCase;
  const external = project.links.find((l) => l.label === "Live") ?? project.links[0];
  return (
    <>
      <div className={styles.about}>
        <span className={styles.cap}>{String(i + 1).padStart(2, "0")} · {project.year} · {project.role}</span>
        <h3 id={id}>{project.title}</h3>
        {!label && <p>{project.summary}</p>}
      </div>
      <div className={styles.act}>
        {!label && project.metric && (
          <p className={styles.metric}>
            <s>{project.metric.before}</s> <span aria-hidden="true">→</span>
            <span className={styles.srOnly}> to </span> {project.metric.after}
          </p>
        )}
        <div className={styles.links}>
          {external && (
            <a href={external.href} target="_blank" rel="noreferrer">
              {external.label === "Live" ? "Open live" : "View code"} <span aria-hidden="true">↗</span>
            </a>
          )}
          {hasCase && <Link href={`/projects/${project.slug}`}>Case study</Link>}
        </div>
      </div>
    </>
  );
}

/** Share of the scroll between two projects spent resting with a project centred in the window. */
const HOLD = .4;

/**
 * The projects, after Oryzo's strip: a row of small frames slides across the middle as you scroll,
 * and the large dotted frame in the middle is a magnifier over it. The frames and the window share
 * one shape and move in step, so whatever passes under the window shows enlarged, edge to edge;
 * mid-scroll one project leaves to the left as the next comes in from the right. The one in the
 * window plays its recording, and its name and links stand as a label at the top left. Each small
 * frame is a button that brings its project into the window; only the project in the window has
 * reachable links. Reduced motion gets a plain list.
 */
export default function LaunchReel({ projects }: { projects: Project[] }) {
  const section = useRef<HTMLElement>(null);
  const strip = useRef<HTMLOListElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const captions = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = section.current, track = strip.current, shown = stage.current;
    if (!root || !track || !shown) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const items = () => [...shown.children] as HTMLElement[];
    const caps = () => [...(captions.current?.children ?? [])] as HTMLElement[];

    function update() {
      frame = 0;
      if (!root || !track || !shown) return;
      if (reduce.matches) {
        shown.style.transform = "";
        items().forEach((item) => item.querySelector("video")?.pause());
        return;
      }
      const r = root.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      // Each project rests in the window for a stretch of scrolling (HOLD of the way between two
      // projects), then the strip moves on to the next, eased in and out.
      const n = items().length, u = progress * (n - 1), i0 = Math.min(n - 2, Math.floor(u)), t = u - i0;
      const m = Math.min(1, Math.max(0, (t - HOLD / 2) / (1 - HOLD))), f = n > 1 ? i0 + m * m * (3 - 2 * m) : 0, focus = Math.round(f);
      // The strip slides so the frame for the current place in the scroll sits under the middle.
      // The strip runs on both sides of the window and never behind it: tiles still to come line up
      // from its right edge, tiles already seen from its left edge. A tile going in is cut off at the
      // right edge as it slides under the window; one coming out grows back from the left edge.
      const thumbs = [...track.children] as HTMLElement[];
      const w = thumbs[0]?.offsetWidth ?? 0, gap = parseFloat(getComputedStyle(track).getPropertyValue("--gap")) || 16, pitch = w + gap;
      const box = shown.parentElement!.getBoundingClientRect(), L = box.left - 7 - gap, R = box.right + 7 + gap;
      thumbs.forEach((t, i) => {
        const d = i - f;
        let x: number, cutL = 0, cutR = 0;
        if (d >= 0) { x = R + (d - 1) * pitch; cutL = Math.max(0, R - x); }
        else { x = L + (d + 1) * pitch - w; cutR = Math.max(0, x + w - L); }
        const hidden = cutL + cutR >= w - .5;
        t.style.transform = `translate3d(${x}px, 0, 0)`;
        t.style.clipPath = hidden ? "inset(0 50% 0 50%)" : `inset(0 ${cutR}px 0 ${cutL}px)`;
        t.style.visibility = hidden ? "hidden" : "";
        t.toggleAttribute("data-on", i === focus);
      });
      // The big frame's row moves one frame-width per project, in step with the strip, so the next
      // project slides in from the right as the current one leaves to the left.
      shown.style.transform = `translate3d(${-f * (shown.parentElement?.offsetWidth ?? 0)}px, 0, 0)`;
      // The project in the middle is shown large; only it plays, and only while the section is on screen.
      const onScreen = r.top < innerHeight && r.bottom > 0;
      caps().forEach((cap, i) => { const off = i !== focus; cap.toggleAttribute("data-off", off); cap.inert = off; });
      items().forEach((item, i) => {
        const off = i !== focus;
        const video = item.querySelector("video");
        if (video) { if (!off && onScreen) { if (video.paused) video.play().catch(() => {}); } else if (!video.paused) video.pause(); }
      });
      if (count.current) count.current.textContent = `${String(focus + 1).padStart(2, "0")}/${String(n).padStart(2, "0")}`;
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

    // A small frame, clicked or activated from the keyboard, scrolls its project to the middle.
    const onPick = (event: MouseEvent) => {
      const thumb = (event.target as HTMLElement).closest<HTMLElement>("[data-thumb]");
      if (!thumb || reduce.matches) return;
      const i = Number(thumb.dataset.thumb), n = track.children.length;
      const r = root.getBoundingClientRect();
      const top = window.scrollY + r.top + (i / Math.max(1, n - 1)) * (r.height - innerHeight);
      if (window.__lenis) window.__lenis.scrollTo(top, { duration: .9 }); else window.scrollTo({ top, behavior: "smooth" });
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduce.addEventListener("change", schedule);
    track.addEventListener("click", onPick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduce.removeEventListener("change", schedule);
      track.removeEventListener("click", onPick);
    };
  }, []);

  return (
    <section ref={section} className={styles.pin} id="work" aria-labelledby="work-title" style={{ ["--cards" as string]: projects.length }}>
      <div className={styles.frame}>
        <h2 id="work-title" className={styles.head}>
          <span>Six projects,</span> all shipped
        </h2>

        <ol ref={strip} className={styles.strip} aria-label="Projects">
          {projects.map((project, i) => {
            const demo = DEMOS[project.slug];
            const thumb = demo?.poster ?? PREVIEWS[project.slug];
            return (
              <li key={project.slug}>
                <button type="button" className={styles.thumb} data-thumb={i} aria-label={`Show ${project.title}`}>
                  {thumb && <img src={withBasePath(thumb)} alt="" width={480} height={640} loading="lazy" decoding="async" />}
                </button>
              </li>
            );
          })}
        </ol>

        <div className={styles.stage}>
          {/* A window onto a row of all six: scrolling slides them through it, side by side. */}
          <div className={styles.window}>
          <div ref={stage} className={styles.row}>
          {projects.map((project, i) => {
            const demo = DEMOS[project.slug];
            const preview = PREVIEWS[project.slug];
            const alt = project.images?.find((image) => image.src === preview)?.alt ?? `${project.title} interface`;
            return (
              <article key={project.slug} className={styles.item} aria-labelledby={`work-${project.slug}`}>
                <div className={styles.media}>
                  {demo ? (
                    <video src={withBasePath(demo.src)} poster={withBasePath(demo.poster)} aria-label={alt} width={demo.w} height={demo.h} muted loop playsInline preload="none" />
                  ) : preview ? (
                    <img className={styles.pan} src={withBasePath(preview)} alt={alt} width={1280} height={720} loading="lazy" decoding="async" />
                  ) : null}
                </div>
                {/* Reduced motion lists the projects; there each carries its own caption. */}
                <div className={styles.inlineCap}><Caption project={project} i={i} /></div>
              </article>
            );
          })}
          </div>
          </div>
        </div>

        {/* The project in the window, as a label at the top left: number, name, links. */}
        <div ref={captions} className={styles.labels}>
          {projects.map((project, i) => (
            <div key={project.slug} className={styles.label} data-off={i ? "" : undefined}>
              <Caption project={project} i={i} id={`work-${project.slug}`} label />
            </div>
          ))}
        </div>

        <span ref={count} className={styles.count} aria-hidden="true">01/{String(projects.length).padStart(2, "0")}</span>
      </div>
    </section>
  );
}
