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
  /** Shown under the image on the case page. */
  caption?: string;
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
  /**
   * Still frame for the video, with intrinsic dimensions so the slot reserves
   * its space and nothing shifts. Cards render this; the video is attached to
   * the card that is actually being looked at.
   */
  poster?: ProjectImage;
  featured?: boolean;
  wip?: boolean;
  /** No case study written. Cards fall through to the first external link. */
  noCase?: boolean;
  /** Longer-form description paragraphs, rendered on the case page. */
  overview?: string[];
  /** Bullet-point feature list, rendered on the case page. */
  highlights?: string[];
  /** Two sentences on what the problem was, rendered above the overview. */
  problem?: string;
  /** What came of it. Rendered at the end of the case page. */
  outcome?: string;

  /**
   * Left over from a spectrum-analyser hero that no longer exists. Nothing
   * renders these any more and they carry invented values on the projects
   * that are not RF, so they are optional and on their way out.
   *
   * @deprecated
   */
  frequency?: number;
  /** @deprecated */
  amplitude?: number;
  /** @deprecated */
  band?: string;
}
