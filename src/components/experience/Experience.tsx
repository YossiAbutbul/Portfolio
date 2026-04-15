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
  kind: "work" | "education" | "service";
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
      "Designed a React + FastAPI platform to automate RF testing over Bluetooth, integrating Power and Spectrum Analyzers for real-time measurement, analysis, and report generation.",
      "Built a web interface for interactive visualization of antenna radiation patterns and RF performance metrics.",
      "Led hardware–software bring-up of NB-IoT, CAT-M, and LoRa modules with custom Python automation.",
      "Advanced debugging and optimization for LoRa, LTE, and Bluetooth systems — both software-driven and RF measurement-driven.",
    ],
  },
  {
    period: "Oct 2022 — Present",
    year: "2022 —",
    org: "The Open University",
    role: "BSc Computer Science (GPA 88)",
    kind: "education",
    current: true,
    bullets: [
      "Coursework focus on systems programming, algorithms, and architecture.",
      "Capstone: Two-pass assembler (ANSI C90) translating into base-4 machine code.",
    ],
  },
  {
    period: "Apr 2017 — Dec 2019",
    year: "2017 – 19",
    org: "IDF · Intelligence Corps · Unit 81",
    role: "Operational Project Leader · RF Technician",
    kind: "service",
    bullets: [
      "Led and managed technological and operational projects under tight deadlines.",
      "Built Python automation tools to log and analyze Spectrum Analyzer data.",
      "Hands-on troubleshooting and integration of advanced RF systems.",
    ],
  },
];

const KIND_LABEL: Record<TimelineItem["kind"], string> = {
  work: "WORK",
  education: "EDU",
  service: "SERVICE",
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
          <SectionLabel index="04">Experience</SectionLabel>
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
