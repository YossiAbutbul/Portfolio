import Link from "next/link";
import type { Project } from "@/types/project";
import TagPill from "./TagPill";
import ImageSlider from "./ImageSlider";
import styles from "./ProjectCard.module.css";

const TAG_LABEL: Record<Project["tags"][number], string> = {
  software: "SW",
  hardware: "HW",
  embedded: "EMB",
};

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <article className={styles.card}>
      <div className={styles.imageWrap}>
        <ImageSlider
          images={project.images}
          slug={project.slug}
          interval={2200}
        />
      </div>

      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.tags}>
            {project.tags.map((t) => (
              <TagPill key={t}>{TAG_LABEL[t]}</TagPill>
            ))}
          </span>
        </div>

        <h3 className={styles.title}>
          <Link href={`/projects/${project.slug}/`} className={styles.titleLink}>
            {project.title}
          </Link>
        </h3>
        <p className={styles.summary}>{project.summary}</p>
        <p className={styles.stack}>{project.stack.join(" · ")}</p>
      </div>
    </article>
  );
}
