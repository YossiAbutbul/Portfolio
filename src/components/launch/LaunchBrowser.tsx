"use client";

import { useEffect, useRef } from "react";
import type { Project } from "@/types/project";
import { withBasePath } from "@/lib/env";
import { DEMOS, PREVIEWS } from "./projectMedia";
import styles from "./LaunchBrowser.module.css";

/** The address a project lives at, as a browser shows it: no scheme, no trailing slash. */
const address = (href: string) => href.replace(/^https?:\/\//, "").replace(/\/$/, "");

/**
 * The projects in one browser window: the section pins, and each flick of the wheel (or swipe, or
 * arrow key) moves one project on; the page slides in from the side you're heading, the address bar
 * types its URL and a progress bar runs over it.
 * Lab tools with no public site open at their source instead, marked as such. The label on the left
 * carries the real links. Reduced motion gets a plain list with each recording in place.
 */
export default function LaunchBrowser({ projects }: { projects: Project[] }) {
  const section = useRef<HTMLElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const tab = useRef<HTMLSpanElement>(null);
  const win = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = section.current, field = bar.current, title = tab.current, frame = win.current;
    if (!root || !field || !title || !frame) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const items = [...root.querySelectorAll<HTMLElement>("[data-item]")];
    const shots = [...frame.querySelectorAll<HTMLElement>("[data-shot]")];
    const n = items.length;
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
    /* Direction-aware swap: going down, the new page slides in from the right and the new label rises
       from below while the old ones leave left and up; going up, the reverse. Transform and opacity
       only, set inline: the entering element is placed on its side without a transition first. */
    function swap(list: HTMLElement[], to: number, from: number, dir: number, axis: "X" | "Y", dist: string, show: (el: HTMLElement, on: boolean) => void) {
      list.forEach((el, k) => {
        if (k === to) {
          el.style.transition = "none";
          el.style.transform = `translate${axis}(calc(${dir} * ${dist}))`;
          void el.offsetWidth;
          el.style.transition = "";
          el.style.transform = "";
          show(el, true);
        } else {
          if (k === from) el.style.transform = `translate${axis}(calc(${-dir} * ${dist}))`;
          show(el, false);
        }
      });
    }
    // Show the page at once, then retype the address and run the progress bar over it as dressing,
    // quickly, so scrolling on never waits for it.
    function open(i: number, from: number) {
      clearInterval(typing); clearTimeout(loaded);
      const url = items[i].dataset.url ?? "", dir = from < 0 || i > from ? 1 : -1;
      title!.textContent = items[i].dataset.title ?? "";
      frame!.toggleAttribute("data-source", items[i].hasAttribute("data-source"));
      shots.forEach((shot, k) => { const v = shot.querySelector("video"); if (k === i && v) v.preload = "auto"; });
      items.forEach((item, k) => { item.inert = k !== i; });
      if (from !== i) {
        swap(items, i, from, dir, "Y", "1.6rem", (el, on) => el.toggleAttribute("data-off", !on));
        swap(shots, i, from, dir, "X", "7%", (el, on) => el.toggleAttribute("data-on", on));
      } else {
        items.forEach((item, k) => item.toggleAttribute("data-off", k !== i));
        shots.forEach((shot, k) => shot.toggleAttribute("data-on", k === i));
      }
      shown = i; play();
      if (reduce.matches) { field!.textContent = url; frame!.dataset.state = "done"; return; }
      frame!.dataset.state = "typing";
      field!.textContent = "";
      // A few characters a tick, so any address types in about 0.35 s.
      const step = Math.max(1, Math.ceil(url.length / 14));
      let c = 0;
      typing = window.setInterval(() => {
        c = Math.min(url.length, c + step);
        field!.textContent = url.slice(0, c);
        if (c >= url.length) {
          clearInterval(typing);
          frame!.dataset.state = "loading";
          loaded = window.setTimeout(() => { frame!.dataset.state = "done"; }, 450);
        }
      }, 25);
    }
    const progressOf = (r: DOMRect) => Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
    function update() {
      raf = 0;
      if (reduce.matches) {
        items.forEach((item) => { item.removeAttribute("data-off"); item.inert = false; item.style.transform = ""; });
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
          shown = -1;
        }
        play();
        return;
      }
      // Leaving (the section's end scrolling up past the screen): the frame fades and drifts up.
      const leave = Math.min(1, Math.max(0, 1 - r.bottom / innerHeight));
      // Gone by the time it is a third of the way off, so it never hangs ghosted over the next scene.
      frame!.parentElement!.style.opacity = leave ? String(Math.max(0, 1 - leave * 3)) : "";
      frame!.parentElement!.style.transform = leave ? `translate3d(0, ${-leave * 8}svh, 0) scale(${1 - leave * .06})` : "";
      const next = Math.min(n - 1, Math.floor(progressOf(r) * n));
      if (next !== focus) {
        const from = focus;
        focus = next;
        open(focus, from < 0 ? (next === 0 ? 0 : next - 1) : from);
      }
      play();
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };

    /* One flick, one project. While the section holds the screen, a wheel gesture, a swipe or an arrow
       / page key moves exactly one project: the page glides to the middle of the next project's
       stretch and further input is ignored until the glide ends and the gesture (trackpad momentum
       included) has died away. Past the first or last project, input scrolls the page as usual. */
    let locked = false, quiet = 0, acc = 0, accReset = 0, touchY: number | null = null;
    const held = () => { const r = root!.getBoundingClientRect(); return r.top <= 2 && r.bottom >= innerHeight - 2; };
    const current = () => Math.min(n - 1, Math.floor(progressOf(root!.getBoundingClientRect()) * n));
    const canStep = (dir: number) => { const i = current(); return dir > 0 ? i < n - 1 : i > 0; };
    const unlockWhenQuiet = () => { clearTimeout(quiet); quiet = window.setTimeout(() => { locked = false; acc = 0; }, 220); };
    function go(dir: number) {
      const i = Math.max(0, Math.min(n - 1, current() + dir));
      const r = root!.getBoundingClientRect();
      const top = window.scrollY + r.top + ((i + .5) / n) * (r.height - innerHeight);
      locked = true;
      if (window.__lenis) window.__lenis.scrollTo(top, { duration: .85, lock: true, force: true, onComplete: unlockWhenQuiet });
      else { window.scrollTo({ top, behavior: "smooth" }); window.setTimeout(unlockWhenQuiet, 700); }
    }
    // Capture on window, ahead of the smooth scroller's own wheel listener, so a handled gesture never
    // also scrolls the page.
    const onWheel = (e: WheelEvent) => {
      if (reduce.matches || e.ctrlKey || !held()) return;
      const dir = Math.sign(e.deltaY);
      if (!dir || (!locked && !canStep(dir))) return;
      e.preventDefault(); e.stopPropagation();
      if (locked) { if (quiet) unlockWhenQuiet(); return; }
      acc += e.deltaY; clearTimeout(accReset); accReset = window.setTimeout(() => { acc = 0; }, 200);
      if (Math.abs(acc) >= 18) { acc = 0; go(dir); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (reduce.matches || !held() || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const dir = ["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey) ? 1
        : ["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey) ? -1 : 0;
      if (!dir || !canStep(dir)) return;
      e.preventDefault();
      if (!locked) go(dir);
    };
    const onTouchStart = (e: TouchEvent) => { touchY = held() && !reduce.matches ? e.touches[0].clientY : null; };
    const onTouchMove = (e: TouchEvent) => {
      if (touchY === null) return;
      const dir = Math.sign(touchY - e.touches[0].clientY);
      if (locked || (dir && canStep(dir))) e.preventDefault();
      else touchY = null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchY === null) return;
      const dy = touchY - e.changedTouches[0].clientY, dir = Math.sign(dy);
      touchY = null;
      if (!locked && Math.abs(dy) > 40 && canStep(dir)) go(dir);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduce.addEventListener("change", schedule);
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      cancelAnimationFrame(raf); clearInterval(typing); clearTimeout(loaded); clearTimeout(quiet); clearTimeout(accReset);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduce.removeEventListener("change", schedule);
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const first = projects[0];
  const firstLink = first.links.find((l) => l.label === "Live") ?? first.links[0];

  return (
    <section ref={section} className={styles.pin} id="work" aria-labelledby="work-title" style={{ ["--cards" as string]: projects.length }}>
      <div className={styles.frame}>
        <h2 id="work-title" className={styles.head}>
          Work
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
                    <video src={withBasePath(demo.src)} poster={withBasePath(demo.poster)} width={demo.w} height={demo.h} muted loop playsInline preload="none" />
                  ) : preview ? (
                    <img src={withBasePath(preview)} alt="" width={1280} height={720} loading="lazy" decoding="async" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
