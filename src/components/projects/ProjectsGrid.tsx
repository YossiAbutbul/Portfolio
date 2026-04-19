"use client";

import { useMemo, useState } from "react";
import { PROJECTS } from "@content/projects";
import type { ProjectTag } from "@/types/project";
import ProjectCard from "./ProjectCard";
import SectionLabel from "@/components/ui/SectionLabel";
import styles from "./ProjectsGrid.module.css";

type Filter = "all" | ProjectTag;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "software", label: "Software" },
  { id: "hardware", label: "Hardware" },
  { id: "embedded", label: "Embedded" },
];

export default function ProjectsGrid() {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    if (filter === "all") return PROJECTS;
    return PROJECTS.filter((p) => p.tags.includes(filter));
  }, [filter]);

  return (
    <section id="projects" className={styles.section} aria-labelledby="projects-label">
      <div className="container">
        <div id="projects-label">
          <SectionLabel index="02">Projects</SectionLabel>
        </div>

        <div
          className={styles.filters}
          role="tablist"
          aria-label="Filter projects by discipline"
          data-reveal
          data-reveal-delay="1"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`${styles.filter} ${filter === f.id ? styles.filterActive : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          {visible.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
