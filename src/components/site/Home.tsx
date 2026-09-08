"use client";

import Link from "next/link";
import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FEATURED_PROJECTS, OTHER_PROJECTS } from "@content/projects";
import { withBasePath } from "@/lib/env";
import type { Project } from "@/types/project";
// Hero object. Swap this single import to compare the two:
//   ./SignalCore  - the torus knot
//   ./SignalGraph - the graph running a breadth-first search
import HeroObject from "./SignalGraph";
import ProjectSignature, { type SignatureKind } from "./ProjectSignature";
import styles from "./Home.module.css";

gsap.registerPlugin(ScrollTrigger);

const CV_HREF = "/Yossi Abutbul - CV 2026.pdf";
const EMAIL = "abyossi22@gmail.com";
const LINKEDIN = "https://www.linkedin.com/in/yossi-abutbul-550958199/";
const GITHUB = "https://github.com/YossiAbutbul";

/**
 * Each project draws the shape of its own subject rather than showing a
 * screenshot. Keyed by slug so a row never has to know how it is drawn.
 */
const SIGNATURES: Record<string, SignatureKind> = {
  "test-console": "contours",
  oplanner: "semester",
  "pipeline-cpu": "pipeline",
  "current-logger": "bursts",
  algorithmx: "graph",
  "toast-turn": "flat",
};

const PROJECT_PREVIEWS: Record<string, string> = {
  "test-console": "/projects/test-console/screenshot.png",
  oplanner: "/projects/oplanner/poster.jpg",
  "pipeline-cpu": "/projects/pipeline-cpu/poster.jpg",
  "current-logger": "/projects/current-logger/screenshot.png",
  algorithmx: "/projects/algorithmx/screenshot.png",
  "toast-turn": "/projects/toast-turn/cover.png",
};

/**
 * How the work happens, in the order it happens. Each beat is anchored to a
 * real project so it reads as a description rather than a philosophy.
 */
const METHOD = [
  {
    step: "Test Console",
    title: "Start with the manual procedure",
    detail:
      "I worked through the RF test procedure instrument by instrument, then built a console to run the sequence and record the results.",
  },
  {
    step: "Current Logger",
    title: "Record what the device actually does",
    detail:
      "The logger captures transmit bursts and saves each measurement. I can inspect a live test or go back through a saved run.",
  },
  {
    step: "OPlanner",
    title: "Build around the data already available",
    detail:
      "My university provides a calendar export. I used it to populate courses and deadlines, so I don't have to enter my semester by hand.",
  },
];

const BACKGROUND = [
  {
    years: "2020 to present",
    kind: "Work",
    role: "RF & Electronics Integrator",
    place: "Arad Technologies",
    detail:
      "Test systems where radio hardware, automation and interface design meet. Built the automation platform that took a three-day qualification cycle to roughly eight minutes.",
  },
  {
    years: "2022 to present",
    kind: "Education",
    role: "BSc Computer Science",
    place: "The Open University",
    detail:
      "Systems programming, algorithms, computer architecture, software engineering. Currently writing a seminar on generating user interfaces with LLMs.",
  },
  {
    years: "2017 to 2019",
    kind: "Army service",
    role: "Operational Project Leader",
    place: "IDF Intelligence, Unit 81",
    detail:
      "Led multi-disciplinary RF projects, ran field integration, and wrote the Python tooling for spectrum analyzer data collection.",
  },
];

export default function Home() {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!root.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Finish entrance animations when hidden so a background tab stays readable.
    const animations: gsap.core.Animation[] = [];

    function settle() {
      if (!document.hidden) return;
      for (const animation of animations) animation.progress(1);
    }

    const context = gsap.context(() => {
      gsap.set("[data-hero-line]", { yPercent: 104 });
      gsap.set("[data-hero-fade]", { opacity: 0, y: 14 });

      animations.push(
        gsap
          .timeline({ defaults: { ease: "expo.out" } })
          .to("[data-hero-line]", { yPercent: 0, duration: 1, stagger: 0.08 }, 0.1)
          .to("[data-hero-fade]", { opacity: 1, y: 0, duration: 0.6, stagger: 0.06 }, 0.5),
      );

      // Scroll entrances never hide the project content.
      gsap.utils.toArray<HTMLElement>("[data-rise]").forEach((element) => {
        animations.push(
          gsap.from(element, {
            y: 24,
            duration: 0.8,
            ease: "expo.out",
            scrollTrigger: { trigger: element, start: "top 92%", once: true },
          }),
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-project]").forEach((element) => {
        animations.push(gsap.from(element, {
          y: 48,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: element, start: "top 95%", once: true },
        }));
      });

      ScrollTrigger.refresh();
      settle();
    }, root);

    document.addEventListener("visibilitychange", settle);

    return () => {
      document.removeEventListener("visibilitychange", settle);
      context.revert();
    };
  }, []);

  return (
    <div ref={root} className={styles.page}>
      {/* ------------------------------------------------------------------ */}
      <section id="hero" className={styles.hero} aria-labelledby="hero-name">
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroLayout}>
          <div className={styles.heroBody}>
            <h1 id="hero-name" className={styles.heroName}>
              <span className={styles.clip}>
                <span data-hero-line>Yossi</span>
              </span>
              <span className={styles.clip}>
                <span data-hero-line>Abutbul</span>
              </span>
            </h1>

            <p className={styles.claim} data-hero-fade>
              <span>Software developer.</span>
              <span>RF &amp; electronics integrator.</span>
            </p>

            <p className={styles.claimSub} data-hero-fade>
              I build test automation at Arad Technologies and study computer science at the Open University. These are some of the tools I’ve built for work, for my studies, and for home.
            </p>

            <div className={styles.heroActions} data-hero-fade>
              <a className={styles.button} href="#work">
                View projects
              </a>
              <a className={styles.buttonGhost} href={withBasePath(CV_HREF)} download>
                Download CV
              </a>
            </div>
          </div>

            <div className={styles.heroPlot}>
              <HeroObject />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <Section id="work" title="Selected projects">

        <ol className={styles.workList}>
          {FEATURED_PROJECTS.map((project) => (
            <WorkRow key={project.slug} project={project} />
          ))}
        </ol>

        <div className={styles.also} data-rise>
          <h3 className={`mono ${styles.alsoLabel}`}>Also</h3>
          <ul className={styles.alsoList}>
            {OTHER_PROJECTS.map((project) => {
              const body = (
                <>
                  <span className={styles.alsoName}>{project.title}</span>
                  <span className={styles.alsoSummary}>{project.summary}</span>
                </>
              );
              // Some of these still have a full case study written; send those
              // to it rather than straight out to the repo.
              return (
                <li key={project.slug}>
                  {project.noCase ? (
                    <a
                      className={styles.alsoLink}
                      href={project.links[0]?.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {body}
                    </a>
                  ) : (
                    <Link className={styles.alsoLink} href={`/projects/${project.slug}`}>
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section id="method" title="How I work">
        <ol className={styles.method}>
          {METHOD.map((beat) => (
            <li key={beat.step} className={styles.methodItem} data-rise>
              <span className={`mono ${styles.methodStep}`}>
                {beat.step}
              </span>
              <h3 className={styles.methodTitle}>{beat.title}</h3>
              <p className={styles.methodDetail}>{beat.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section id="writing" title="Writing">
        <article className={styles.paper} data-rise>
          <span className={`mono ${styles.paperMeta}`}>
            Seminar · The Open University · In progress
          </span>
          <h3 className={styles.paperTitle}>
            Creating User Interfaces Using LLMs: From Specification to Code
          </h3>
          <p className={styles.paperBody}>
            My computer science seminar examines how language models turn written specifications into interfaces, the errors they make, and how the specification affects the result.
          </p>
        </article>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section id="background" title="Background">
        <ol className={styles.timeline}>
          {BACKGROUND.map((entry) => (
            <li key={entry.role} className={styles.entry} data-rise>
              <span className={`mono ${styles.entryYears}`}>{entry.years}</span>
              <div className={styles.entryBody}>
                <span className={`mono ${styles.entryKind}`}>{entry.kind}</span>
                <h3 className={styles.entryRole}>{entry.role}</h3>
                <span className={styles.entryPlace}>{entry.place}</span>
                <p className={styles.entryDetail}>{entry.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className={styles.cvRow} data-rise>
          <a className={styles.button} href={withBasePath(CV_HREF)} download>
            Download CV
          </a>
          <span className={`mono ${styles.cvNote}`}>PDF · Updated September 2026</span>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section id="contact" title="Contact">
        <p className={styles.contactLede} data-rise>
          The fastest way to reach me is email. I read everything.
        </p>

        <div className={styles.contactPrimary} data-rise>
          <a className={styles.contactEmail} href={`mailto:${EMAIL}`}>
            {EMAIL}
          </a>
        </div>

        <ul className={styles.contactList} data-rise>
          <li>
            <span className={`mono ${styles.contactLabel}`}>LinkedIn</span>
            <a className={styles.contactValue} href={LINKEDIN} target="_blank" rel="noreferrer">
              yossi-abutbul
            </a>
          </li>
          <li>
            <span className={`mono ${styles.contactLabel}`}>GitHub</span>
            <a className={styles.contactValue} href={GITHUB} target="_blank" rel="noreferrer">
              YossiAbutbul
            </a>
          </li>
        </ul>
      </Section>

      <footer className={styles.footer}>
        <div className={`container mono ${styles.footerInner}`}>
          <span>Yossi Abutbul · 2026</span>
          <a href="#hero">Back to top</a>
        </div>
      </footer>
    </div>
  );
}

/** A chapter in the portfolio, with a consistent navigation anchor. */
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={`container ${styles.sectionInner}`}>
        <div className={styles.sectionMain}>
          <h2 id={`${id}-title`} className={styles.sectionTitle} data-rise>
            {title}
          </h2>
          {children}
        </div>
      </div>
    </section>
  );
}

function WorkRow({ project }: { project: Project }) {
  const [active, setActive] = useState(false);
  const hasCase = !project.noCase;
  const external = project.links.find((link) => link.label === "Live") ?? project.links[0];
  const href = hasCase ? `/projects/${project.slug}` : external?.href ?? "#";
  const signature = SIGNATURES[project.slug];
  const preview = PROJECT_PREVIEWS[project.slug];

  const inner = (
    <>
      <div className={styles.projectVisual}>
        {preview ? (
          <div className={styles.previewFrame}>
            <Image src={withBasePath(preview)} alt={project.images?.find((image) => image.src === preview)?.alt ?? `${project.title} interface`} width={1280} height={720} sizes="(max-width: 768px) 90vw, 42vw" className={styles.previewImage} />
          </div>
        ) : (
          <div className={styles.plotFrame} aria-hidden="true">
            <div className={styles.largeSignature}>{signature && <ProjectSignature kind={signature} active={active} />}</div>
            <span className={styles.plotLabel}>{project.slug === "test-console" ? "Load-pull contours" : project.slug === "current-logger" ? "Transmit current over time" : "Graph traversal"}</span>
          </div>
        )}
      </div>
      <div className={styles.rowBody}>
        <div className={styles.rowHead}>
          <h3 className={styles.rowTitle}>{project.title}</h3>
          {project.metric && (
            <span className={`mono ${styles.metric}`}>
              <s>{project.metric.before}</s>
              <span aria-hidden="true">→</span>
              <b>{project.metric.after}</b>
            </span>
          )}
        </div>

        <p className={styles.rowSummary}>{project.summary}</p>

        <ul className={`mono ${styles.stack}`}>
          {project.stack.slice(0, 5).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

    </>
  );

  const handlers = {
    onPointerEnter: () => setActive(true),
    onPointerLeave: () => setActive(false),
    onFocus: () => setActive(true),
    onBlur: () => setActive(false),
  };

  return (
    <li className={styles.row} data-project>
      {hasCase ? (
        <Link className={styles.rowLink} href={href} {...handlers}>
          {inner}
        </Link>
      ) : (
        <a className={styles.rowLink} href={href} target="_blank" rel="noreferrer" {...handlers}>
          {inner}
        </a>
      )}
    </li>
  );
}
