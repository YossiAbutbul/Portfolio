export interface Post {
  /** Start year. The timeline is ordered by this, newest first. */
  from: number;
  /** Absent means it is still current. */
  to?: number;
  kind: "Work" | "Education" | "Army service";
  role: string;
  place: string;
  detail: string;
}

/** Lifted out of the home page component so the copy lives with the content. */
export const EXPERIENCE: Post[] = [
  {
    from: 2022,
    kind: "Education",
    role: "BSc Computer Science",
    place: "The Open University",
    detail:
      "Coursework includes systems programming, algorithms, computer architecture, and software engineering.",
  },
  {
    from: 2020,
    kind: "Work",
    role: "RF & Electronics Integrator",
    place: "Arad Technologies",
    detail:
      "I design test systems where radio hardware, automation, data, and usable interfaces meet. One automated platform cut a three-day lab cycle to roughly eight minutes.",
  },
  {
    from: 2017,
    to: 2019,
    kind: "Army service",
    role: "Operational Project Leader",
    place: "IDF Intelligence, Unit 81",
    detail:
      "Led multi-disciplinary RF projects, handled field integration, and built Python tools for spectrum analyser data collection.",
  },
];

export function span(post: Post): string {
  return `${post.from} to ${post.to ?? "now"}`;
}
