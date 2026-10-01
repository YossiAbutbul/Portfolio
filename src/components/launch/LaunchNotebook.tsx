"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Project } from "@/types/project";
import styles from "./LaunchNotebook.module.css";

/** Share of the scroll between two spreads spent resting on a spread, so each one can be read. */
const HOLD = .45;

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** The left page of a project's spread: its name, what it is, and what it was built with. */
function Notes({ project, n }: { project: Project; n: number }) {
  return (
    <>
      <span className={styles.date}>{String(n).padStart(2, "0")} · {project.year}{project.wip ? " · still going" : ""}</span>
      <h3 className={styles.title}>{project.title}</h3>
      <p className={styles.note}>{project.summary}</p>
      <ul className={styles.ticks}>
        {project.stack.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </>
  );
}

/** The right page: the stack sketched as boxes and arrows, and where to see it. */
function Sketch({ project }: { project: Project }) {
  const boxes = project.stack.slice(0, 3);
  const live = project.links.find((l) => l.label === "Live");
  const code = project.links.find((l) => l.label === "GitHub");
  return (
    <>
      <div className={styles.flow} aria-hidden="true">
        {boxes.map((box, i) => (
          <span key={box} className={styles.box} style={{ ["--tilt" as string]: `${[-2, 1.5, -1][i]}deg`, ["--shift" as string]: `${[0, 18, 4][i]}%` }}>{box}</span>
        ))}
      </div>
      <span className={styles.aside} aria-hidden="true">{project.role.toLowerCase()}</span>
      <div className={styles.go}>
        {live && <a href={live.href} target="_blank" rel="noreferrer">open it ↗</a>}
        {code && <a href={code.href} target="_blank" rel="noreferrer">code ↗</a>}
      </div>
    </>
  );
}

/** What the hologram over the notebook says about a project: name and a few facts. */
function Holo({ project }: { project: Project }) {
  return (
    <>
      <span className={styles.hk}>{project.wip ? "in progress" : "shipped"} · {project.year}</span>
      <strong className={styles.hn}>{project.title}</strong>
      <span className={styles.hr}>{project.role}</span>
      <span className={styles.hs}>{project.stack.slice(0, 4).map((item) => <i key={item}>{item}</i>)}</span>
    </>
  );
}

/**
 * More work, as the notebook from the desk. As the section arrives the lights come up on the desk, the
 * notebook slides in across it and, as the scene's camera drops low across the table, lies down onto
 * the table's plane (CSS perspective matched to the scene's camera). Then its pages turn as you
 * scroll, a spread per project, written by hand, the first spread being the index; a warm hologram
 * stands over the far edge of the book with the open project's name and a few facts. Transform
 * only; only the spread lying open is reachable. Reduced motion lays the pages out flat.
 */
export default function LaunchNotebook({ projects }: { projects: Project[] }) {
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const leaves = [...root.querySelectorAll<HTMLElement>("[data-leaf]")];
    const pages = [...root.querySelectorAll<HTMLElement>("[data-page]")];
    const holos = [...root.querySelectorAll<HTMLElement>("[data-holo]")];
    const caps = [...root.querySelectorAll<HTMLElement>("[data-cap]")];
    let raf = 0, shown = -1;

    function update() {
      raf = 0;
      if (reduce.matches) {
        leaves.forEach((leaf) => { leaf.style.transform = ""; leaf.style.zIndex = ""; });
        pages.forEach((page) => { page.inert = false; });
        return;
      }
      const r = root!.getBoundingClientRect(), n = leaves.length;
      const p = clamp(-r.top / Math.max(1, r.height - innerHeight));
      // Once the 3D wall stands behind the top of the screen, the bar and the heading go dark to read
      // on its pale plaster (Nav follows data-nav-force="light"). The wall rises during the scene's crane
      // shot, while the section is still coming in: it is up behind the bar by the time the section's
      // top is 45% of the way down the screen (the scene's low camera passes ~.4 there).
      const onWall = r.top < innerHeight * .45 && r.bottom > 0 && !!document.querySelector('canvas[data-ready="true"]');
      if (onWall !== (root!.dataset.navForce === "light")) {
        if (onWall) root!.dataset.navForce = "light"; else delete root!.dataset.navForce;
        // Nav checks on scroll, possibly earlier in this same frame: tell it the backdrop changed.
        window.dispatchEvent(new Event("launch:nav"));
      }
      // The pages follow the whole pinned scroll (as the scene's 3D notebook does).
      const u = p * n;
      leaves.forEach((leaf, j) => {
        // Rest, turn (eased), rest: the turn takes the middle of each stretch.
        const m = clamp((u - j - HOLD / 2) / (1 - HOLD)), f = m * m * (3 - 2 * m);
        leaf.style.transform = `translateZ(var(--thick)) rotateY(${-180 * f}deg)`;
        // A lifted page catches less light: shade it most when it stands on edge.
        leaf.style.setProperty("--turn", (Math.sin(f * Math.PI) * .9).toFixed(3));
        // Unturned leaves stack first-on-top on the right; turned ones last-on-top on the left.
        leaf.style.zIndex = String(f > .5 ? 10 + j : 10 + n - j);
      });
      // Only the spread lying open can be reached.
      const open = Math.round(u);
      pages.forEach((page) => { page.inert = Number(page.dataset.page) !== open; });
      if (open !== shown) {
        shown = open;
        holos.forEach((h, k) => h.toggleAttribute("data-on", k === open));
        caps.forEach((c, k) => { c.toggleAttribute("data-on", k === open); c.inert = k !== open; });
      }
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduce.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduce.removeEventListener("change", schedule);
    };
  }, []);

  // Spread 0 is the index; spread k (1..) is projects[k - 1]. Each spread has a left and a right page.
  const left = (k: number): ReactNode => k === 0 ? (
    <>
      <span className={styles.date}>also shipped</span>
      <h3 className={`${styles.title} ${styles.big}`}>more work</h3>
      <p className={styles.note}>Smaller, older, or still going. Each one runs, and each one taught me something the six above use.</p>
      <span className={styles.arrow} aria-hidden="true">turn the page ↷</span>
    </>
  ) : <Notes project={projects[k - 1]} n={k} />;
  const right = (k: number): ReactNode => k === 0 ? (
    <>
      <span className={styles.date}>contents</span>
      <ol className={styles.index}>
        {projects.map((p, i) => <li key={p.slug}><span>{p.title}</span><b>{String(i + 1).padStart(2, "0")}</b></li>)}
      </ol>
    </>
  ) : <Sketch project={projects[k - 1]} />;
  const spreads = projects.length + 1;

  return (
    <section
      ref={section}
      className={styles.pin}
      id="notebook"
      aria-labelledby="notebook-title"
      style={{ ["--spreads" as string]: spreads }}
      // The scene draws the 3D notebook and its hologram from these.
      data-projects={JSON.stringify(projects.map(({ title, year, role, wip, summary, stack }) => ({ title, year, role, wip, summary, stack })))}
    >
      <div className={styles.frame}>
        <h2 id="notebook-title" className={styles.head}><span>Also shipped,</span> more work</h2>
        {/* With the 3D notebook on the desk, the open project's name and real links sit here, bottom
            left; the book drawn below is the fallback (reduced motion, or no WebGL). */}
        <div className={styles.caps}>
          <div className={styles.cap} data-cap data-on="">
            <span className={styles.capMeta}>Contents · {projects.length} projects</span>
            <strong className={styles.capName}>Smaller, older, or still going.</strong>
          </div>
          {projects.map((project, i) => {
            const live = project.links.find((l) => l.label === "Live"), code = project.links.find((l) => l.label === "GitHub");
            return (
              <div key={project.slug} className={styles.cap} data-cap>
                <span className={styles.capMeta}>{String(i + 1).padStart(2, "0")} · {project.year} · {project.role}</span>
                <strong className={styles.capName}>{project.title}</strong>
                <p className={styles.capText}>{project.summary}</p>
                <span className={styles.capLinks}>
                  {live && <a href={live.href} target="_blank" rel="noreferrer">Open live ↗</a>}
                  {code && <a href={code.href} target="_blank" rel="noreferrer">Code ↗</a>}
                </span>
              </div>
            );
          })}
        </div>
        <div className={styles.book} data-book>
          {/* The hologram: decorative, since the open spread says the same in writing. */}
          <div className={styles.holo} aria-hidden="true">
            <div className={styles.beam} />
            <div className={styles.panel}>
              <div className={styles.slot} data-holo data-on="">
                <span className={styles.hk}>also shipped</span>
                <strong className={styles.hn}>More work</strong>
                <span className={styles.hr}>{projects.length} projects · {Math.min(...projects.map((p) => p.year))}–{Math.max(...projects.map((p) => p.year))}</span>
              </div>
              {projects.map((project) => (
                <div key={project.slug} className={styles.slot} data-holo><Holo project={project} /></div>
              ))}
            </div>
          </div>
          {/* The paper block's edges, under the pages, and the light the hologram throws on them. */}
          <span className={`${styles.edge} ${styles.edgeNear}`} aria-hidden="true" />
          <span className={`${styles.edge} ${styles.edgeSide}`} aria-hidden="true" />
          <span className={`${styles.edge} ${styles.edgeSide} ${styles.edgeLeft}`} aria-hidden="true" />
          <span className={styles.pool} aria-hidden="true" />
          <div className={`${styles.page} ${styles.left}`} data-page={0}>{left(0)}</div>
          {Array.from({ length: spreads - 1 }, (_, j) => (
            <div key={j} className={styles.leaf} data-leaf>
              <div className={`${styles.page} ${styles.right} ${styles.front}`} data-page={j}>{right(j)}</div>
              <div className={`${styles.page} ${styles.left} ${styles.back}`} data-page={j + 1}>{left(j + 1)}</div>
            </div>
          ))}
          <div className={`${styles.page} ${styles.right}`} data-page={spreads - 1}>{right(spreads - 1)}</div>
        </div>
      </div>
    </section>
  );
}
