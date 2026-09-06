"use client";

import Link from "next/link";
import { useState } from "react";
import { FEATURED_PROJECTS } from "@content/projects";
import { withBasePath } from "@/lib/env";
import type { Project } from "@/types/project";
import styles from "./page.module.css";

/**
 * Case study, set as a spec page: a title block, a specifications table, the
 * prose, then the feature list. The table comes before the prose on purpose -
 * most people reading a datasheet want the numbers and never read the body.
 */
export default function ProjectDetail({ project }: { project: Project }) {
  const cases = FEATURED_PROJECTS.filter((entry) => !entry.noCase);
  const index = cases.findIndex((entry) => entry.slug === project.slug);
  const previous = index > 0 ? cases[index - 1] : null;
  const next = index >= 0 && index < cases.length - 1 ? cases[index + 1] : null;

  return (
    <article className={styles.page}>
      <div className={`container ${styles.inner}`}>
        <header className={styles.header}>
          <div className={`mono ${styles.stamp}`}>
            <span>
              Case {String(index + 1).padStart(2, "0")} / {String(cases.length).padStart(2, "0")}
            </span>
            <span>
              {project.year}
              {project.wip ? " · In progress" : ""}
            </span>
          </div>

          <h1 className={styles.title}>{project.title}</h1>
          <p className={styles.summary}>{project.summary}</p>

          {project.metric && (
            <p className={`mono ${styles.metric}`}>
              <s>{project.metric.before}</s>
              <span aria-hidden="true">→</span>
              <b>{project.metric.after}</b>
            </p>
          )}
        </header>

        <div className={styles.body}>
          <div className={styles.main}>
            {project.friction && (
              <section className={styles.section}>
                <h2 className={`mono ${styles.sectionHeading}`}>The problem</h2>
                <p className={styles.lead}>{project.friction}</p>
              </section>
            )}

            <section className={styles.section}>
              <h2 className={`mono ${styles.sectionHeading}`}>Overview</h2>
              {(project.overview ?? [project.summary]).map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className={styles.paragraph}>
                  {paragraph}
                </p>
              ))}
            </section>

            {project.highlights && project.highlights.length > 0 && (
              <section className={styles.section}>
                <h2 className={`mono ${styles.sectionHeading}`}>What it does</h2>
                <ol className={styles.highlights}>
                  {project.highlights.map((item, position) => (
                    <li key={item}>
                      <span className={`mono ${styles.highlightIndex}`}>
                        {String(position + 1).padStart(2, "0")}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {project.images && project.images.length > 0 && (
              <section className={styles.section}>
                <h2 className={`mono ${styles.sectionHeading}`}>Screens</h2>
                <Plates project={project} />
              </section>
            )}
          </div>

          <aside className={styles.aside}>
            <h2 className={`mono ${styles.sectionHeading}`}>Specifications</h2>
            <dl className={styles.spec}>
              <div>
                <dt className="mono">Year</dt>
                <dd>{project.year}</dd>
              </div>
              <div>
                <dt className="mono">Role</dt>
                <dd>{project.role}</dd>
              </div>
              <div>
                <dt className="mono">Domain</dt>
                <dd>{project.tags.join(", ")}</dd>
              </div>
              <div>
                <dt className="mono">Stack</dt>
                <dd>
                  <ul className={styles.stack}>
                    {project.stack.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="mono">Links</dt>
                <dd>
                  <ul className={styles.links}>
                    {project.links.map((link) => (
                      <li key={link.href}>
                        <a href={link.href} target="_blank" rel="noreferrer">
                          {link.label}
                          <span aria-hidden="true"> ↗</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </aside>
        </div>

        <nav className={styles.pager} aria-label="Other case studies">
          {previous ? (
            <Link className={styles.pagerLink} href={`/projects/${previous.slug}`}>
              <span className={`mono ${styles.pagerLabel}`}>← Previous</span>
              <span className={styles.pagerTitle}>{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link className={`${styles.pagerLink} ${styles.pagerNext}`} href={`/projects/${next.slug}`}>
              <span className={`mono ${styles.pagerLabel}`}>Next →</span>
              <span className={styles.pagerTitle}>{next.title}</span>
            </Link>
          )}
        </nav>
      </div>
    </article>
  );
}

/** Screens, shown as plates with the selected one full width. */
function Plates({ project }: { project: Project }) {
  const images = project.images ?? [];
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div className={styles.plates}>
      <figure className={styles.plate}>
        <img
          src={withBasePath(current.src)}
          alt={current.alt}
          width={current.width}
          height={current.height}
          loading="lazy"
        />
        <figcaption className={`mono ${styles.plateCaption}`}>{current.alt}</figcaption>
      </figure>

      {images.length > 1 && (
        <div className={styles.thumbs} role="tablist" aria-label="Screens">
          {images.map((image, position) => (
            <button
              key={image.src}
              type="button"
              role="tab"
              aria-selected={position === active}
              className={`${styles.thumb} ${position === active ? styles.thumbActive : ""}`}
              onClick={() => setActive(position)}
            >
              <img src={withBasePath(image.src)} alt="" width={image.width} height={image.height} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
