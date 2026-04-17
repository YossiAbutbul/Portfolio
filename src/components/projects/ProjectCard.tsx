"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project } from "@/types/project";
import TagPill from "./TagPill";
import ImageSlider from "./ImageSlider";
import HoverVideo from "./HoverVideo";
import styles from "./ProjectCard.module.css";

const TAG_LABEL: Record<Project["tags"][number], string> = {
  software: "SW",
  hardware: "HW",
  embedded: "EMB",
};

export default function ProjectCard({ project }: { project: Project }) {
  const [hovered, setHovered] = useState(false);
  const hasVideo = Boolean(project.video);

  const [videoAspect, setVideoAspect] = useState<number | null>(null);

  const wrapStyle = hasVideo
    ? { aspectRatio: String(videoAspect ?? 16 / 9) }
    : undefined;

  return (
    <article
      className={styles.card}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.imageWrap} style={wrapStyle}>
        {hasVideo ? (
          <>
            <HoverVideo
              src={project.video!}
              active={hovered}
              onAspect={setVideoAspect}
            />
            <Link
              href={`/projects/${project.slug}/`}
              className={styles.posterLink}
              aria-label={project.title}
            />
            <span className={styles.hoverHint} aria-hidden="true">
              <span className={styles.hoverHintIcon}>▶</span>
              HOVER
            </span>
          </>
        ) : (
          <ImageSlider
            images={project.images}
            slug={project.slug}
            interval={2200}
            paddingRatio={0}
          />
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.tags}>
            {project.tags.map((t) => (
              <TagPill key={t}>{TAG_LABEL[t]}</TagPill>
            ))}
            {project.wip && <TagPill>WIP</TagPill>}
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
