import Link from "next/link";
import ReleaseTiles from "./ReleaseTiles";
import styles from "./LaunchSections.module.css";

const RELEASES = [
  { version: "2017-2019", big: "Unit 81", role: "Operational Project Leader", detail: "IDF Intelligence. RF projects end to end, and Python tooling for spectrum analyzer data.", tone: "olive" },
  { version: "2020-PRESENT", big: "RF & Electronics", role: "RF Technician, Arad Technologies", detail: "Bring-up and qualification of RF hardware, and the test software around it.", tone: "sand" },
  { version: "2022-PRESENT", big: "BSc Computer Science Student", role: "The Open University", detail: "Systems programming, algorithms, architecture, software engineering.", tone: "cork" },
] as const;

// The stack, picked by hand and grouped: what the work is built on, RF and test last.
const STACK = [
  { label: "Languages", items: ["TypeScript", "Python", "C", "C++"] },
  { label: "Frontend", items: ["React", "Next.js"] },
  { label: "Backend & data", items: ["FastAPI", "Firebase"] },
  { label: "Hardware & test", items: ["PyVISA", "SCPI", "BLE", "LoRa"] },
];

/** The cream page: release history, the stack, and the seminar as a paper. */
export default function LaunchEditorial() {


  return (
    <section className={styles.editorial} id="experience" aria-labelledby="experience-title" data-nav="light">
      <h2 className={styles.big} id="experience-title">experience</h2>
      <ReleaseTiles releases={RELEASES} stack={STACK} />

      <div className={styles.paper} id="paper">
        <div>
          <h3 className={styles.sectionHead}>Paper</h3>
        </div>
        <div>
          <div className={styles.tabs}><span>Paper · in progress</span></div>
          {/* Set as the paper's first page: title, author, abstract, then where it sits. */}
          <article className={styles.sheet} aria-labelledby="paper-title">
            <h3 id="paper-title">Creating User Interfaces Using LLMs: From Specification to Code</h3>
            <p className={styles.sheetAuthor}>Yossi Abutbul · The Open University</p>
            <span className={styles.sheetLabel}>Abstract</span>
            <p>
              How language models turn a written spec into a working interface, where they get it wrong,
              and how much the wording of the spec changes what comes out.
            </p>
            <p className={styles.sheetFoot}><span>Seminar</span><span>2026</span><span>In progress</span></p>
          </article>
        </div>
      </div>
    </section>
  );
}
