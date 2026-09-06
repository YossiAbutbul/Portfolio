export type ProjectTag = "software" | "hardware" | "embedded";

export interface ProjectLink {
  label: string;
  href: string;
}

export interface ProjectImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface Project {
  slug: string;
  title: string;
  summary: string;
  tags: ProjectTag[];
  year: number;
  role: string;
  stack: string[];
  links: ProjectLink[];
  images?: ProjectImage[];
  video?: string;
  featured?: boolean;
  wip?: boolean;
  /** Whether a /projects/[slug] case study page exists (MDX written). When false, cards link to first external href. */
  noCase?: boolean;
  /** Headline result, set in mono next to the title. Two short halves. */
  metric?: { before: string; after: string };
  /** Why this exists: the friction that came before the code. One sentence. */
  friction?: string;
  /** Legacy spectrum-hero fields, kept so older entries still typecheck. */
  frequency?: number;
  amplitude?: number;
  band?: string;
  /** Longer-form description paragraphs, rendered on the detail page. */
  overview?: string[];
  /** Bullet-point feature list, rendered on the detail page. */
  highlights?: string[];
}
