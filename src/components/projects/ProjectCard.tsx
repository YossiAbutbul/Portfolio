import Link from "next/link";
import type { Project } from "@/types/project";
import TagPill from "./TagPill";
import styles from "./ProjectCard.module.css";

const TAG_LABEL: Record<Project["tags"][number], string> = {
  software: "SW",
  hardware: "HW",
  embedded: "EMB",
};

export default function ProjectCard({ project, marker }: { project: Project; marker: string }) {
  void marker;
  const detailHref = project.noCase
    ? project.links.find((l) => l.href.startsWith("http"))?.href ?? "#"
    : `/projects/${project.slug}/`;
  const isExternal = project.noCase;
  const LinkComp: React.ElementType = isExternal ? "a" : Link;
  const linkProps = isExternal
    ? { href: detailHref, target: "_blank", rel: "noreferrer noopener" }
    : { href: detailHref };

  // Split off the last word so we can glue it to the external arrow with a
  // non-breaking space — keeps "Positioner ↗" together when the title wraps.
  const titleText = project.title;
  const lastSpace = titleText.lastIndexOf(" ");
  const head = lastSpace >= 0 ? titleText.slice(0, lastSpace + 1) : "";
  const tail = lastSpace >= 0 ? titleText.slice(lastSpace + 1) : titleText;

  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <span className={styles.tags}>
          {project.tags.map((t) => (
            <TagPill key={t}>{TAG_LABEL[t]}</TagPill>
          ))}
          {project.wip && <TagPill>WIP</TagPill>}
        </span>
      </header>

      <div className={styles.body}>
        <h3 className={styles.title}>
          <LinkComp {...linkProps} className={styles.titleLink}>
            {head}
            <span className={styles.lastChunk}>
              {tail}
              {isExternal && (
                <span className={styles.extArrow} aria-hidden="true">{" ↗"}</span>
              )}
            </span>
          </LinkComp>
        </h3>
        <p className={styles.summary}>{project.summary}</p>
        <p className={styles.stack}>{project.stack.join(" · ")}</p>
      </div>
    </article>
  );
}
