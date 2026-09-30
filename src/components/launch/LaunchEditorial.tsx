import Link from "next/link";
import type { Project } from "@/types/project";
import styles from "./LaunchSections.module.css";

const RELEASES = [
  { version: "v0.1 · 2017", big: "Unit 81", role: "Operational Project Leader", detail: "IDF Intelligence. RF projects end to end, and Python tooling for spectrum analyzer data.", tone: "olive" },
  { version: "v1.0 · 2020", big: "RF & Electronics", role: "Integrator, smart metering", detail: "Bring-up and qualification of RF hardware, and the test software around it.", tone: "sand" },
  { version: "v2.0 · 2022", big: "BSc CS", role: "The Open University", detail: "Systems programming, algorithms, architecture, software engineering.", tone: "cork" },
] as const;

/** The cream page: release history, the rest of the work, and the seminar as a paper. */
export default function LaunchEditorial({ featured, other }: { featured: Project[]; other: Project[] }) {
  // The stack card lists what the projects actually use, most used first.
  const counts = new Map<string, number>();
  featured.forEach((p) => p.stack.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1)));
  const stack = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s);

  return (
    <section className={styles.editorial} id="changelog" aria-labelledby="changelog-title">
      <span className={styles.cap}>Release history</span>
      <h2 className={styles.big} id="changelog-title">experience</h2>
      <p className={styles.lede}>Every version was field-tested before the next one shipped. No versions were skipped.</p>
      <ol className={styles.tiles}>
        {RELEASES.map((r) => (
          <li key={r.version} className={styles.tile} data-tone={r.tone}>
            <span className={styles.cap}>{r.version}</span>
            <div>
              <span className={styles.tileBig}>{r.big}</span>
              <h3>{r.role}</h3>
              <p>{r.detail}</p>
            </div>
          </li>
        ))}
        <li className={styles.tile} data-tone="ink">
          <span className={styles.cap}>Stack · in production</span>
          <p className={styles.stackText}>{stack.join(" · ")}</p>
        </li>
      </ol>

      <div className={styles.also}>
        <div>
          <span className={styles.cap}>Also shipped</span>
          <h3 className={styles.sectionHead}>More work</h3>
        </div>
        <ul>
          {other.map((p) => {
            const body = <><strong>{p.title}</strong><span>{p.summary}</span></>;
            return (
              <li key={p.slug}>
                {p.noCase
                  ? <a href={p.links[0]?.href} target="_blank" rel="noreferrer">{body}</a>
                  : <Link href={`/projects/${p.slug}`}>{body}</Link>}
              </li>
            );
          })}
        </ul>
      </div>

      <div className={styles.paper} id="paper">
        <div>
          <span className={styles.cap}>Our latest research</span>
          <h3 className={styles.sectionHead}>Paper</h3>
        </div>
        <div>
          <div className={styles.tabs}><span>Paper · in progress</span><span data-off>Code coming soon</span></div>
          <h3>Creating User Interfaces Using LLMs: From Specification to Code</h3>
          <p>
            How language models turn a written spec into a working interface, where they get it wrong,
            and how much the wording of the spec changes what comes out. Seminar, The Open University.
          </p>
          <pre>{`@misc{abutbul2026ui,
  title  = {Creating User Interfaces Using LLMs: From Specification to Code},
  author = {Abutbul, Yossi},
  note   = {Seminar, The Open University. In progress.}
}`}</pre>
        </div>
      </div>
    </section>
  );
}
