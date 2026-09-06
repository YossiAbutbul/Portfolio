import Link from "next/link";
import { WORK } from "@content/copy";
import type { Project } from "@/types/project";
import { projectHref, isExternal } from "@/lib/project";
import styles from "./Work.module.css";

/**
 * The project list at rest.
 *
 * One markup set at every width. The previous build shipped a desktop stage
 * and a mobile list side by side in the DOM and hid one with display:none,
 * which cost five duplicate headings, five video elements and five poster
 * requests on every device. The pinned stage in the motion pass is built on
 * top of this markup rather than beside it.
 */
export default function Work({ projects }: { projects: Project[] }) {
  return (
    <section id="work" className={styles.work} aria-labelledby="work-title">
      <div className={`bay ${styles.head}`}>
        <h2 id="work-title">{WORK.heading}</h2>
        <p className={styles.headLine}>{WORK.line}</p>
      </div>

      <ol className={styles.list}>
        {projects.map((project, i) => (
          <li key={project.slug}>
            <ProjectRow project={project} index={i} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function ProjectRow({ project, index }: { project: Project; index: number }) {
  const href = projectHref(project);
  const external = isExternal(href);
  const live = project.links.find((link) => /live/i.test(link.label));
  const still = project.poster ?? project.images?.[0];

  return (
    <article className={`bay ${styles.row}`}>
      <div className={styles.copy}>
        <p className={styles.meta}>
          <span className={`${styles.addr} figures`} aria-hidden="true">
            {(0x40 + index * 0x10).toString(16).padStart(4, "0")}
          </span>
          <span className={`${styles.year} figures`}>{project.year}</span>
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
            <a href={live.href} className={styles.action} target="_blank" rel="noreferrer">
              Live demo
            </a>
          )}
        </p>
      </div>

      {still && (
        <figure className={styles.media}>
          <img
            src={still.src}
            alt={still.alt}
            width={still.width}
            height={still.height}
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
            sizes="(max-width: 46rem) 100vw, 60vw"
          />
        </figure>
      )}
    </article>
  );
}
