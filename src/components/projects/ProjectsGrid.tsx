"use client";

import { useMemo } from "react";
import { OTHER_PROJECTS } from "@content/projects";
import type { Project } from "@/types/project";
import ProjectCard from "./ProjectCard";
import styles from "./ProjectsGrid.module.css";

function sizeFor(p: Project): "lg" | "sm" {
  if (p.featured && (p.images?.length || p.video)) return "lg";
  return "sm";
}

export default function ProjectsGrid() {
  const visible = useMemo(() => {
    return [...OTHER_PROJECTS].sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    });
  }, []);

  return (
    <section id="projects" className={styles.section} aria-label="More projects">
      <div className="container">
        <div className={styles.bento}>
          {visible.map((p, i) => (
            <div key={p.slug} className={styles.cell} data-size={sizeFor(p)}>
              <ProjectCard project={p} marker={`P${(i + 1).toString().padStart(2, "0")}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
