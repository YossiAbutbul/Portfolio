"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FEATURED_PROJECTS, OTHER_PROJECTS } from "@content/projects";
import { withBasePath } from "@/lib/env";
import type { Project } from "@/types/project";
import PatternPlot from "./PatternPlot";
import styles from "./Home.module.css";

gsap.registerPlugin(ScrollTrigger);

const CV_HREF = "/Yossi Abutbul - CV 2026.pdf";
const EMAIL = "abyossi22@gmail.com";
const LINKEDIN = "https://www.linkedin.com/in/yossi-abutbul-550958199/";
const GITHUB = "https://github.com/YossiAbutbul";

/**
 * How the work happens, in the order it happens. Each beat is anchored to a
 * real project so it reads as a description rather than a philosophy.
 */
const METHOD = [
  {
    step: "Notice",
    title: "Something takes too long, and everyone has stopped noticing",
    detail:
      "Five instruments driven by hand. A report rebuilt from the same spreadsheet every week. A semester spread across six tabs. The friction is usually invisible because it has always been there.",
  },
  {
    step: "Measure",
    title: "Make the invisible part visible before touching it",
    detail:
      "Plot the decay. Colour the graph as the algorithm runs. Draw the radiation pattern as a surface you can turn. You cannot automate a process you cannot yet watch, and half the time watching it is the whole fix.",
  },
  {
    step: "Automate",
    title: "Then take the person out of the loop",
    detail:
      "Once the procedure is legible it can be driven: a trigger instead of a stopwatch, an import instead of retyping, one console instead of six instrument front panels.",
  },
];

const BACKGROUND = [
  {
    years: "2020 — now",
    kind: "Work",
    role: "RF & Electronics Integrator",
    place: "Arad Technologies",
    detail:
      "Test systems where radio hardware, automation and interface design meet. Built the automation platform that took a three-day qualification cycle to roughly eight minutes.",
  },
  {
    years: "2022 — now",
    kind: "Education",
    role: "BSc Computer Science",
    place: "The Open University",
    detail:
      "Systems programming, algorithms, computer architecture, software engineering. Currently writing a seminar on generating user interfaces with LLMs.",
  },
  {
    years: "2017 — 2019",
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

    // Every animation here starts from a hidden state, and browsers pause
    // requestAnimationFrame in a background tab - so a page opened in an
    // unfocused tab would otherwise render as a blank sheet and stay that way
    // until it was looked at. Track the animations and jump them to their end
    // whenever the document is hidden.
    const animations: gsap.core.Animation[] = [];

    function settle() {
      if (!document.hidden) return;
      for (const animation of animations) animation.progress(1);
    }

    const context = gsap.context(() => {
      // The name is the only large move on the page. Everything after it
      // resolves at a smaller amplitude - a document does not bounce.
      gsap.set("[data-hero-line]", { yPercent: 104 });
      gsap.set("[data-hero-fade]", { opacity: 0, y: 14 });

      animations.push(
        gsap
          .timeline({ defaults: { ease: "expo.out" } })
          .to("[data-hero-line]", { yPercent: 0, duration: 1, stagger: 0.08 }, 0.1)
          .to("[data-hero-fade]", { opacity: 1, y: 0, duration: 0.6, stagger: 0.06 }, 0.5),
      );

      // Section content settles into place but is never hidden to do it: a
      // frozen tween leaves the text eight pixels low, not missing. A sheet of
      // paper does not fade in, and content that depends on JS to become
      // legible is content that can fail to arrive.
      gsap.utils.toArray<HTMLElement>("[data-rise]").forEach((element) => {
        animations.push(
          gsap.from(element, {
            y: 10,
            duration: 0.5,
            ease: "expo.out",
            scrollTrigger: { trigger: element, start: "top 92%", once: true },
          }),
        );
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
          <div className={`mono ${styles.heroStamp}`} data-hero-fade>
            <span>Software · Test automation · RF</span>
            <span>Rev 2026.09</span>
          </div>

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
              Three days of RF testing. <mark>Now eight minutes.</mark>
            </p>

            <p className={styles.claimSub} data-hero-fade>
              I build test automation, measurement software, and the interfaces that make
              lab data readable.
            </p>

            <div className={styles.heroActions} data-hero-fade>
              <a className={styles.button} href={withBasePath(CV_HREF)} download>
                Download CV
              </a>
              <a className={styles.buttonGhost} href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
            </div>
          </div>

            <div className={styles.heroPlot}>
              <PatternPlot />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <Section id="work" index="01" label="Selected work" title="Selected work">
        <p className={styles.sectionLede} data-rise>
          Six of them. Each one started as something that took too long, and each one is
          still in use by whoever had the problem.
        </p>

        <ol className={styles.workList}>
          {FEATURED_PROJECTS.map((project, index) => (
            <WorkRow key={project.slug} project={project} index={index + 1} />
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
      <Section id="method" index="02" label="How I work" title="How I work">
        <ol className={styles.method}>
          {METHOD.map((beat, index) => (
            <li key={beat.step} className={styles.methodItem} data-rise>
              <span className={`mono ${styles.methodStep}`}>
                {String(index + 1).padStart(2, "0")} {beat.step}
              </span>
              <h3 className={styles.methodTitle}>{beat.title}</h3>
              <p className={styles.methodDetail}>{beat.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section id="writing" index="03" label="Writing" title="Writing">
        <article className={styles.paper} data-rise>
          <span className={`mono ${styles.paperMeta}`}>
            Seminar · The Open University · In progress
          </span>
          <h3 className={styles.paperTitle}>
            Creating User Interfaces Using LLMs — From Specification to Code
          </h3>
          <p className={styles.paperBody}>
            How far a written specification can be carried toward a working interface by a
            language model, where the translation reliably breaks down, and what a
            specification has to contain before the generated result is worth keeping.
          </p>
        </article>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section id="background" index="04" label="Background" title="Background">
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
      <Section id="contact" index="05" label="Contact" title="Get in touch">
        <p className={styles.sectionLede} data-rise>
          The fastest way to reach me is email. I read everything.
        </p>

        <ul className={styles.contactList} data-rise>
          <li>
            <span className={`mono ${styles.contactLabel}`}>Email</span>
            <a className={styles.contactValue} href={`mailto:${EMAIL}`}>
              {EMAIL}
            </a>
          </li>
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
        </div>
      </footer>
    </div>
  );
}

/** A numbered sheet section: sticky label in the margin, content in the column. */
function Section({
  id,
  index,
  label,
  title,
  children,
}: {
  id: string;
  index: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={`container ${styles.sectionInner}`}>
        <div className={styles.sectionAside}>
          <span className={`mono ${styles.sectionIndex}`}>
            {index} / {label}
          </span>
        </div>
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

function WorkRow({ project, index }: { project: Project; index: number }) {
  const hasCase = !project.noCase;
  const external = project.links.find((link) => link.label === "Live") ?? project.links[0];
  const href = hasCase ? `/projects/${project.slug}` : external?.href ?? "#";

  const inner = (
    <>
      <span className={`mono ${styles.rowIndex}`}>{String(index).padStart(2, "0")}</span>

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

        {project.friction && <p className={styles.rowFriction}>{project.friction}</p>}
        <p className={styles.rowSummary}>{project.summary}</p>

        <ul className={`mono ${styles.stack}`}>
          {project.stack.slice(0, 5).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <span className={styles.rowGo} aria-hidden="true">
        {hasCase ? "Case" : "Open"} <span className={styles.rowArrow}>→</span>
      </span>
    </>
  );

  return (
    <li className={styles.row}>
      {hasCase ? (
        <Link className={styles.rowLink} href={href}>
          {inner}
        </Link>
      ) : (
        <a className={styles.rowLink} href={href} target="_blank" rel="noreferrer">
          {inner}
        </a>
      )}
    </li>
  );
}
