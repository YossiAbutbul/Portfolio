import type { Project } from "@/types/project";

/**
 * Where a project card should point.
 *
 * Projects without a case study fall through to their first external link,
 * so a card is never a dead end.
 */
export function projectHref(project: Project): string {
  if (!project.noCase) return `/projects/${project.slug}/`;
  return project.links[0]?.href ?? "/";
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}
