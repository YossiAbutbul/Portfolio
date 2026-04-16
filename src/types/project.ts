export type ProjectTag = "software" | "hardware" | "embedded";

export interface ProjectLink {
  label: string;
  href: string;
}

export interface ProjectImage {
  src: string; // relative to basePath — prefix with basePath() helper when rendering
  alt: string;
  width: number;
  height: number;
}

export interface Project {
  slug: string; // kebab-case, matches MDX filename
  title: string;
  summary: string; // 1–2 sentences for the card
  tags: ProjectTag[]; // at least one
  year: number;
  role: string; // 'Solo', 'Team — role', etc.
  stack: string[];
  links: ProjectLink[];
  images: ProjectImage[]; // [0] is card + detail hero
  featured?: boolean;
  wip?: boolean;
}
