"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Project } from "@/types/project";
import { withBasePath } from "@/lib/env";
import { DEMOS, PREVIEWS } from "./projectMedia";
import styles from "./LaunchBrowser.module.css";

/** The address a project lives at, as a browser shows it: no scheme, no trailing slash. */
const address = (href: string) => href.replace(/^https?:\/\//, "").replace(/\/$/, "");

/**
 * The projects in one browser window: the section pins, and each time you scroll on to the next
 * project the address bar types its URL, a progress bar loads, and the window shows it running.
 * Lab tools with no public site open at their source instead, marked as such. The label on the left
 * carries the real links. Reduced motion gets a plain list with each recording in place.
 */
export default function LaunchBrowser({ projects }: { projects: Project[] }) {
  const section = useRef<HTMLElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const tab = useRef<HTMLSpanElement>(null);
  const win = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = section.current, field = bar.current, title = tab.current, frame = win.current;
    if (!root || !field || !title || !frame) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const items = [...root.querySelectorAll<HTMLElement>("[data-item]")];
    const shots = [...frame.querySelectorAll<HTMLElement>("[data-shot]")];
    const dots = [...root.querySelectorAll<HTMLElement>("[data-dot]")];
    let raf = 0, focus = 0, typing = 0, loaded = 0, shown = 0;

    // Plays the one in view, while the section holds the screen.
    function play() {
      const r = root!.getBoundingClientRect(), pinned = r.top < innerHeight && r.bottom > 0;
      shots.forEach((shot, i) => {
        const v = shot.querySelector("video");
        if (!v) return;
        if (i === shown && pinned && !reduce.matches) { if (v.paused) v.play().catch(() => {}); }
        else if (!v.paused) v.pause();
      });
    }
    function reveal(i: number) {
      shown = i;
      frame!.dataset.state = "done";
      shots.forEach((shot, k) => shot.toggleAttribute("data-on", k === i));
      play();
    }
    // Retype the address, run the progress bar, then show the page.
    function open(i: number) {
      clearInterval(typing); clearTimeout(loaded);
      const url = items[i].dataset.url ?? "";
      title!.textContent = items[i].dataset.title ?? "";
      frame!.toggleAttribute("data-source", items[i].hasAttribute("data-source"));
      shots.forEach((shot, k) => { const v = shot.querySelector("video"); if (k === i && v) v.preload = "auto"; });
      if (reduce.matches) { field!.textContent = url; reveal(i); return; }
      frame!.dataset.state = "typing";
      field!.textContent = "";
      let n = 0;
      typing = window.setInterval(() => {
        n += 1;
        field!.textContent = url.slice(0, n);
        if (n >= url.length) {
          clearInterval(typing);
          frame!.dataset.state = "loading";
          loaded = window.setTimeout(() => reveal(i), 650);
        }
      }, Math.max(14, Math.min(34, 800 / url.length)));
    }
    function update() {
      raf = 0;
      if (reduce.matches) {
        items.forEach((item) => { item.removeAttribute("data-off"); item.inert = false; });
        root!.querySelectorAll("video").forEach((v) => v.pause());
        return;
      }
      const r = root!.getBoundingClientRect();
      // Until the section arrives, the window waits with an empty address bar, so the first project's
      // URL types as you reach it (and again each time you come back down to it).
      if (r.top > innerHeight * .5) {
        if (focus !== -1) {
          focus = -1; clearInterval(typing); clearTimeout(loaded);
          field!.textContent = ""; frame!.dataset.state = "typing";
        }
        play();
        return;
      }
      const progress = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      const next = Math.min(items.length - 1, Math.floor(progress * items.length));
      if (next !== focus) {
        focus = next;
        items.forEach((item, i) => { item.toggleAttribute("data-off", i !== focus); item.inert = i !== focus; });
        dots.forEach((dot, i) => dot.toggleAttribute("data-on", i === focus));
        if (count.current) count.current.textContent = `${String(focus + 1).padStart(2, "0")}/${String(items.length).padStart(2, "0")}`;
        open(focus);
      }
      play();
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    const onPick = (event: MouseEvent) => {
      const dot = (event.target as HTMLElement).closest<HTMLElement>("[data-dot]");
      if (!dot || reduce.matches) return;
      const i = Number(dot.dataset.dot), r = root.getBoundingClientRect();
      const top = window.scrollY + r.top + ((i + .5) / items.length) * (r.height - innerHeight);
      if (window.__lenis) window.__lenis.scrollTo(top, { duration: .9 }); else window.scrollTo({ top, behavior: "smooth" });
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduce.addEventListener("change", schedule);
    root.addEventListener("click", onPick);
    return () => {
      cancelAnimationFrame(raf); clearInterval(typing); clearTimeout(loaded);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduce.removeEventListener("change", schedule);
      root.removeEventListener("click", onPick);
    };
  }, []);

  const first = projects[0];
  const firstLink = first.links.find((l) => l.label === "Live") ?? first.links[0];

  return (
    <section ref={section} className={styles.pin} id="work" aria-labelledby="work-title" style={{ ["--cards" as string]: projects.length }}>
      <div className={styles.frame}>
        <h2 id="work-title" className={styles.head}>
          <span>Six projects,</span> all shipped
        </h2>

        <div className={styles.items}>
          {projects.map((project, i) => {
            const live = project.links.find((l) => l.label === "Live");
            const external = live ?? project.links[0];
            return (
              <article key={project.slug} className={styles.item} data-item data-url={external ? address(external.href) : ""} data-title={project.title} data-source={live ? undefined : ""} aria-labelledby={`work-${project.slug}`}>
                <span className={styles.meta}>
                  <b>{String(i + 1).padStart(2, "0")}</b> {project.year} · {project.role}
                </span>
                <h3 id={`work-${project.slug}`}>{project.title}</h3>
                <p className={styles.summary}>{project.summary}</p>
                {project.metric && (
                  <p className={styles.metric}>
                    <s>{project.metric.before}</s> <span aria-hidden="true">→</span>
                    <span className={styles.srOnly}> to </span> {project.metric.after}
                  </p>
                )}
                <div className={styles.links}>
                  {!project.noCase && <Link className={styles.pill} href={`/projects/${project.slug}`}>Case study</Link>}
                  {external && (
                    <a href={external.href} target="_blank" rel="noreferrer">
                      {live ? "Open live" : "View code"} <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* The browser: decorative, since each project's label above carries its name and links. */}
        <div ref={win} className={styles.window} data-state="done" data-source={first.links.some((l) => l.label === "Live") ? undefined : ""} aria-hidden="true">
          <div className={styles.chrome}>
            <span className={styles.lights}><i /><i /><i /></span>
            <span className={styles.tab}><span ref={tab}>{first.title}</span></span>
          </div>
          <div className={styles.addr}>
            <span className={styles.nav}>‹ ›</span>
            <span className={styles.field}>
              <span className={styles.lock} />
              <span ref={bar}>{firstLink ? address(firstLink.href) : ""}</span>
              <span className={styles.caret} />
              <span className={styles.badge}>lab tool · source</span>
            </span>
            <span className={styles.progress} />
          </div>
          <div className={styles.view}>
            {projects.map((project, i) => {
              const demo = DEMOS[project.slug];
              const preview = PREVIEWS[project.slug];
              return (
                <div key={project.slug} className={styles.shot} data-shot data-on={i === 0 ? "" : undefined}>
                  {demo ? (
                    <video src={withBasePath(demo.src)} poster={withBasePath(demo.poster)} width={demo.w} height={demo.h} muted loop playsInline preload={i === 0 ? "auto" : "none"} />
                  ) : preview ? (
                    <img className={styles.pan} src={withBasePath(preview)} alt="" width={1280} height={720} loading="lazy" decoding="async" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.rail}>
          <span ref={count} className={styles.count} aria-hidden="true">01/{String(projects.length).padStart(2, "0")}</span>
          <div className={styles.dots}>
            {projects.map((project, i) => (
              <button key={project.slug} type="button" data-dot={i} aria-label={`Show ${project.title}`}>
                {String(i + 1).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
