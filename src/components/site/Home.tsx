"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { FEATURED_PROJECTS, OTHER_PROJECTS } from "@content/projects";
import { withBasePath } from "@/lib/env";
import LaunchStage from "@/components/launch/LaunchStage";
import LaunchIntro from "@/components/launch/LaunchIntro";
import LaunchShips from "@/components/launch/LaunchShips";
import LaunchReel from "@/components/launch/LaunchReel";
import ContactForm from "./ContactForm";
import styles from "./Home.module.css";

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
      "Ran RF projects end to end (spec, integration, field trials) and wrote the Python tooling for spectrum analyzer data collection.",
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
      <LaunchStage />
      <LaunchIntro />

      {/* ------------------------------------------------------------------ */}
      <LaunchShips />
      <LaunchReel projects={FEATURED_PROJECTS} />

      <Section id="also" title="Also shipped">
        <div className={styles.also} data-rise>
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
            A seminar on how language models turn a written spec into a working interface: where they get it wrong, and how much the wording of the spec changes what comes out.
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
        {/* The word passes behind the card, which is what keeps it from
            colliding with anything set on top of it. */}
        <div className={styles.contactStage}>
          <span className={styles.contactGhost} aria-hidden="true">
            Contact
          </span>

          <div className={styles.contactCard}>
            <div className={styles.contactGrid}>
              <div className={styles.contactAside}>
                <p className={styles.contactLede} data-rise>
                  Work, a question, or something you think I would find interesting. All of it is
                  welcome.
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
              </div>

              <ContactForm email={EMAIL} />
            </div>
          </div>
        </div>
      </Section>

      <footer className={styles.footer}>
        <div className={`container mono ${styles.footerInner}`}>
          <span>Yossi Abutbul · 2026</span>
          <a href="#top">Back to top</a>
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
