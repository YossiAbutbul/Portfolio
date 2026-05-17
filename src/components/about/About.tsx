import SectionLabel from "@/components/ui/SectionLabel";
import CountUpStat from "./CountUpStat";
import LiveCountStat from "./LiveCountStat";
import styles from "./About.module.css";

interface Stat {
  value: number;
  unit?: string;
  label: string;
}

const STATS: Stat[] = [
  { value: 5,  unit: "+yrs", label: "RF / automation @ Arad" },
  { value: 50, unit: "%+",   label: "lab reporting time cut" },
];

export default function About() {
  return (
    <section id="about" className={styles.section} aria-labelledby="about-label">
      <div className="container">
        <div id="about-label">
          <SectionLabel index="01">About</SectionLabel>
        </div>

        <div className={styles.grid}>
          <div className={styles.prose}>
            <p className={styles.lead} data-reveal data-reveal-delay="1">
              BSc Computer Science student at The Open University, building
              software for <strong>RF and embedded systems</strong>.
            </p>
            <p data-reveal data-reveal-delay="2">
              I design <strong>test-automation platforms</strong>,
              antenna-pattern tooling, and workflow software &mdash; pairing
              system-level thinking with low-level hands-on.
            </p>
            <p data-reveal data-reveal-delay="3">
              I like the moments where firmware, hardware, and UI meet.
            </p>
          </div>

          <aside className={styles.side} aria-label="Quick stats">
            <ul className={styles.stats} data-reveal data-reveal-delay="2">
              {STATS.map((s) => (
                <CountUpStat key={s.label} value={s.value} unit={s.unit} label={s.label} />
              ))}
              <LiveCountStat
                base={3650}
                ratePerSecond={1}
                unit="+"
                label="hours of debugging and designing"
              />
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
