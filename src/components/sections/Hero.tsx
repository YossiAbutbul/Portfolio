import Link from "next/link";
import { HERO } from "@content/copy";
import type { Project } from "@/types/project";
import styles from "./Hero.module.css";
import { projectHref } from "@/lib/project";
import HeroDump from "./HeroDump";

/**
 * The hero at rest.
 *
 * This is the resolved state of the dump: an addressed index whose rows are
 * the projects. The canvas that resolves into it arrives with the motion
 * pass and sits behind this markup rather than replacing it, so the readable,
 * keyboard-navigable version is always the one in the document.
 */
export default function Hero({ projects }: { projects: Project[] }) {
  return (
    <section id="hero" className={`entrance ${styles.hero}`} aria-labelledby="hero-title">
      <HeroDump className={styles.dump} />
      <div className={`bay ${styles.bay}`}>
        <h1 id="hero-title" className={styles.title}>
          {HERO.name.map((part) => (
            <span key={part} className={styles.titleLine}>
              {part}
            </span>
          ))}
        </h1>

        <p className={styles.line}>{HERO.line}</p>

        <nav className={styles.index} aria-label="Projects">
          <ol>
            {projects.map((project, i) => (
              <li key={project.slug} style={{ "--i": i } as React.CSSProperties}>
                <Link href={projectHref(project)} className={styles.record} prefetch={false}>
                  <span className={`${styles.addr} figures`} aria-hidden="true">
                    {(0x40 + i * 0x10).toString(16).padStart(4, "0")}
                  </span>
                  <span className={styles.recordName}>{project.title}</span>
                  <span className={`${styles.year} figures`}>{project.year}</span>
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </section>
  );
}
