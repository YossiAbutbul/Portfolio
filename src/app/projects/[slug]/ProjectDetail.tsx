import Link from "next/link";
import { FEATURED_PROJECTS } from "@content/projects";
import type { Project } from "@/types/project";
import styles from "./page.module.css";

/**
 * A case study.
 *
 * The previous template rendered images[0] and stopped, which left every
 * caption written for images two onward as dead content. This renders the
 * whole set, and the next project arrives at the end rather than as a bare
 * link.
 */
export default function ProjectDetail({ project }: { project: Project }) {
  const cases = FEATURED_PROJECTS.filter((p) => !p.noCase);
  const index = cases.findIndex((p) => p.slug === project.slug);
  const next = index >= 0 ? cases[(index + 1) % cases.length] : null;

  const lead = project.poster ?? project.images?.[0];
  /* The lead image is already shown at the top; the gallery is the rest. */
  const gallery = (project.images ?? []).filter((image) => image !== lead);

  const live = project.links.find((link) => /live/i.test(link.label));
  const repo = project.links.find((link) => /github/i.test(link.label));
  const others = project.links.filter((link) => link !== live && link !== repo);

  return (
    <article className={styles.page}>
      <header className={`bay ${styles.header}`}>
        <p className={styles.meta}>
          <span className="figures">{project.year}</span>
          <span>{project.role}</span>
          {project.wip && <span className={styles.wip}>In progress</span>}
        </p>
        <h1 className={styles.title}>{project.title}</h1>
        <p className={styles.summary}>{project.summary}</p>
      </header>

      {lead && (
        <div className={`bay ${styles.leadWrap}`}>
          <figure className={styles.lead}>
            {project.video ? (
              <video
                src={project.video}
                poster={lead.src}
                width={lead.width}
                height={lead.height}
                muted
                loop
                playsInline
                controls
                preload="none"
                aria-label={`${project.title} walkthrough`}
              />
            ) : (
              <img
                src={lead.src}
                alt={lead.alt}
                width={lead.width}
                height={lead.height}
                decoding="async"
              />
            )}
          </figure>
        </div>
      )}

      <div className={`bay ${styles.body}`}>
        <div className={styles.content}>
          {project.problem && (
            <section className={styles.block}>
              <h2 className={styles.blockHead}>The problem</h2>
              <p className={styles.paragraph}>{project.problem}</p>
            </section>
          )}

          <section className={styles.block}>
            <h2 className={styles.blockHead}>What I did</h2>
            {(project.overview ?? [project.summary]).map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className={styles.paragraph}>
                {paragraph}
              </p>
            ))}
          </section>

          {project.highlights && project.highlights.length > 0 && (
            <section className={styles.block}>
              <h2 className={styles.blockHead}>Details</h2>
              <ul className={styles.highlights}>
                {project.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {gallery.length > 0 && (
            <section className={styles.block}>
              <h2 className="sr-only">Screens</h2>
              <div className={styles.gallery}>
                {gallery.map((image) => (
                  <figure key={image.src} className={styles.shot}>
                    <img
                      src={image.src}
                      alt={image.alt}
                      width={image.width}
                      height={image.height}
                      loading="lazy"
                      decoding="async"
                      sizes="(max-width: 46rem) 100vw, 40vw"
                    />
                    <figcaption>{image.caption ?? image.alt}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {project.outcome && (
            <section className={styles.block}>
              <h2 className={styles.blockHead}>Where it ended up</h2>
              <p className={styles.paragraph}>{project.outcome}</p>
            </section>
          )}
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.sideBlock}>
            <h2 className={styles.sideHead}>Built with</h2>
            <ul className={styles.stack}>
              {project.stack.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className={styles.sideBlock}>
            <h2 className={styles.sideHead}>Links</h2>
            <ul className={styles.links}>
              {live && (
                <li>
                  <a href={live.href} target="_blank" rel="noreferrer">
                    Live demo
                  </a>
                </li>
              )}
              {repo && (
                <li>
                  <a href={repo.href} target="_blank" rel="noreferrer">
                    Source on GitHub
                  </a>
                </li>
              )}
              {others.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {next && (
        <nav className={styles.nextWrap} aria-label="Next project">
          <Link href={`/projects/${next.slug}/`} className={`bay ${styles.next}`} prefetch={false}>
            <span className={styles.nextLabel}>Next</span>
            <span className={styles.nextTitle}>{next.title}</span>
            {(next.poster ?? next.images?.[0]) && (
              <span className={styles.nextShot} aria-hidden="true">
                <img
                  src={(next.poster ?? next.images![0]).src}
                  alt=""
                  width={(next.poster ?? next.images![0]).width}
                  height={(next.poster ?? next.images![0]).height}
                  loading="lazy"
                  decoding="async"
                  sizes="30vw"
                />
              </span>
            )}
          </Link>
        </nav>
      )}
    </article>
  );
}
