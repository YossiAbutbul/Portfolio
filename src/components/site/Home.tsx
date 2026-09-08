"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FEATURED_PROJECTS, OTHER_PROJECTS } from "@content/projects";
import { withBasePath } from "@/lib/env";
import type { Project } from "@/types/project";
import HeroSequence from "./HeroSequence";
import ProjectSignature, { type SignatureKind } from "./ProjectSignature";
import styles from "./Home.module.css";

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
    title: "Do it by hand first",
    detail:
      "I ran the RF test procedure instrument by instrument until I knew every step, then wrote a console that runs the sequence and records the results.",
  },
  {
    step: "Current Logger",
    title: "Measure, don't assume",
    detail:
      "The logger captures transmit bursts and stores every sample, so a live test and a run from last month get looked at the same way.",
  },
  {
    step: "OPlanner",
    title: "Use the data that already exists",
    detail:
      "The university publishes a calendar export, so OPlanner reads it for courses and deadlines instead of asking me to type in a semester.",
  },
];

const BACKGROUND = [
  {
    years: "2020 to present",
    kind: "Work",
    role: "RF & Electronics Integrator",
    place: "Smart metering industry",
    detail:
      "Bring-up and qualification of RF hardware, and the test software around it. Built the automation platform that took a three-day qualification cycle down to about eight minutes.",
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
      "Ran RF projects end to end — spec, integration, field trials — and wrote the Python tooling for spectrum analyzer data collection.",
  },
];

export default function Home() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let cleanup = () => {};

    async function startMotion() {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (disposed || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);

      // Finish entrance animations when hidden so a background tab stays readable.
      const animations: { progress: (value: number) => unknown }[] = [];

      function settle() {
        if (!document.hidden) return;
        for (const animation of animations) animation.progress(1);
      }

      const context = gsap.context(() => {
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
      cleanup = () => {
        document.removeEventListener("visibilitychange", settle);
        context.revert();
      };
    }

    const frame = requestAnimationFrame(() => { void startMotion(); });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanup();
    };
  }, []);

  return (
    <div ref={root} className={styles.page}>
      {/* ------------------------------------------------------------------ */}
      <HeroSequence />

      {/* ------------------------------------------------------------------ */}
      <Section id="work" title="Projects">

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
            A seminar on how language models turn a written spec into a working interface — where they get it wrong, and how much the wording of the spec changes what comes out.
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
          Email is the surest way to reach me.
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
