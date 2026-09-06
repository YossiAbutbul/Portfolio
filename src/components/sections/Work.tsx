import Link from "next/link";
import { WORK } from "@content/copy";
import type { Project } from "@/types/project";
import { projectHref, isExternal } from "@/lib/project";
import styles from "./Work.module.css";

/**
 * The project list.
 *
 * Each project is a panel rather than a row: it takes most of the viewport,
 * the media is the largest thing in it, and the title runs over the media's
 * left edge so the two read as one object instead of a caption above a
 * picture. The outlined numeral sits behind and gives the scroll a beat.
 *
 * One markup set at every width. The previous build shipped a desktop stage
 * and a mobile list side by side in the DOM and hid one with display:none.
 */
export default function Work({ projects }: { projects: Project[] }) {
  return (
    <section id="work" className={styles.work} aria-labelledby="work-title">
      <header className={`bay ${styles.head}`}>
        <h2 id="work-title" className={styles.headTitle} data-scroll="lift">
          Selected
          <br />
          work
        </h2>
        <p className={styles.headLine}>{WORK.line}</p>
      </header>

      <ol className={styles.list}>
        {projects.map((project, i) => (
          <li key={project.slug}>
            <ProjectPanel project={project} index={i} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function ProjectPanel({ project, index }: { project: Project; index: number }) {
  const href = projectHref(project);
  const external = isExternal(href);
  const live = project.links.find((link) => /live/i.test(link.label));
  const still = project.poster ?? project.images?.[0];

  return (
    <article className={`bay ${styles.panel}`}>
      <span className={`${styles.num} figures`} data-scroll="drift" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>

      {still && (
        <figure className={styles.media} data-scroll="media">
          <img
            src={still.src}
            alt={still.alt}
            width={still.width}
            height={still.height}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : undefined}
            decoding="async"
            sizes="(max-width: 46rem) 100vw, 62vw"
          />
        </figure>
      )}

      <div className={styles.copy} data-scroll="lift">
        <p className={styles.meta}>
          <span className={`${styles.year} figures`}>{project.year}</span>
          <span>{project.role}</span>
          {project.wip && <span className={styles.wip}>In progress</span>}
        </p>

        <h3 className={styles.title}>
          <Link
            href={href}
            className={styles.titleLink}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            prefetch={false}
          >
            {project.title}
          </Link>
        </h3>

        <p className={styles.summary}>{project.summary}</p>

        <ul className={styles.stack}>
          {project.stack.slice(0, 5).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p className={styles.actions}>
          <Link
            href={href}
            className={styles.action}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            prefetch={false}
          >
            {external ? "View on GitHub" : "Open case study"}
          </Link>
          {live && (
            <a href={live.href} className={styles.actionQuiet} target="_blank" rel="noreferrer">
              Live demo
            </a>
          )}
        </p>
      </div>
    </article>
  );
}
