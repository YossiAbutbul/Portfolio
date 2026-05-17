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
  /** RF "frequency" in MHz — used as x-position on the spectrum hero peak. Roughly tied to project domain. */
  frequency: number;
  /** Peak amplitude in dB (relative). Higher = taller peak in hero. */
  amplitude: number;
  /** RF band label for marker chip. */
  band: string;
}
