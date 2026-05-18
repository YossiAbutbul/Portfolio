"use client";

import { useEffect, useRef } from "react";
import SectionLabel from "@/components/ui/SectionLabel";
import styles from "./Experience.module.css";

interface TimelineItem {
  period: string;
  year: string;
  org: string;
  role: string;
  bullets: string[];
  kind: "work" | "education" | "army";
  current?: boolean;
}

const ITEMS: TimelineItem[] = [
  {
    period: "May 2020 — Present",
    year: "2020 —",
    org: "Arad Technologies",
    role: "RF & Electronics Integrator",
    kind: "work",
    current: true,
    bullets: [
      "Designed a React + FastAPI platform to automate RF testing over Bluetooth, integrating Power and Spectrum Analyzers for real-time measurement, analysis, and report generation — cut lab reporting time by 50%+.",
      "Built an interactive web interface for visualizing antenna radiation patterns (2D polar + 3D surface) and RF performance metrics.",
      "Led hardware–software bring-up of NB-IoT, CAT-M, and LoRa modules — including FEM integration and system validation via custom Python automation.",
      "Advanced signal analysis, debugging, and optimization for LoRa, LTE, and Bluetooth systems — both software-driven and RF measurement-driven.",
    ],
  },
  {
    period: "Oct 2022 — Present",
    year: "2022 —",
    org: "The Open University of Israel",
    role: "BSc Computer Science",
    kind: "education",
    current: true,
    bullets: [
      "Coursework focus on systems programming, algorithms, and computer architecture.",
      "Project work in C, TypeScript, and React — including a two-pass ANSI C90 assembler and a cycle-accurate pipeline-CPU simulator.",
    ],
  },
  {
    period: "Apr 2017 — Dec 2019",
    year: "2017 – 19",
    org: "IDF · Intelligence Corps · Unit 81",
    role: "Operational Project Leader · RF Technician",
    kind: "army",
    bullets: [
      "Led and managed multi-disciplinary RF/tech projects under tight operational deadlines.",
      "Built Python automation tools to log and analyze Spectrum Analyzer data in the field.",
      "Hands-on troubleshooting and integration of advanced RF systems.",
    ],
  },
];

const KIND_LABEL: Record<TimelineItem["kind"], string> = {
  work: "WORK",
  education: "EDU",
  army: "ARMY",
};

export default function Experience() {
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const items = itemRefs.current.filter((el): el is HTMLLIElement => !!el);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle(styles.active, entry.isIntersecting);
        });
      },
      {
        // Active band: from 20% to 50% down the viewport
        rootMargin: "-20% 0px -50% 0px",
        threshold: 0,
      },
    );

    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="experience"
      className={styles.section}
      aria-labelledby="experience-label"
    >
      <div className="container">
        <div id="experience-label">
          <SectionLabel index="03">Experience</SectionLabel>
        </div>
        <ol className={styles.timeline}>
          {ITEMS.map((it, i) => (
            <li
              key={i}
              ref={(el) => { itemRefs.current[i] = el; }}
              className={styles.item}
              data-reveal
              data-reveal-delay={(((i % 3) + 1)).toString()}
            >
              <div className={styles.metaCol}>
                <span className={styles.year}>{it.year}</span>
                <span
                  className={`${styles.dot} ${it.current ? styles.dotPulse : ""}`}
                  aria-hidden="true"
                />
                <span className={styles.kind}>[ {KIND_LABEL[it.kind]} ]</span>
              </div>
              <div className={styles.body}>
                <p className={styles.period}>{it.period}</p>
                <h3 className={styles.role}>{it.role}</h3>
                <p className={styles.org}>{it.org}</p>
                <ul className={styles.bullets}>
                  {it.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
