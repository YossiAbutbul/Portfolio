import SectionLabel from "@/components/ui/SectionLabel";
import styles from "./Stack.module.css";

interface Group {
  label: string;
  items: string[];
}

const GROUPS: Group[] = [
  { label: "Languages", items: ["TypeScript", "JavaScript", "Python", "C"] },
  { label: "Frontend", items: ["React", "Next.js", "Vite", "Plotly", "Three.js", "Chart.js", "Tailwind"] },
  { label: "Backend / Data", items: ["FastAPI", "REST", "Firebase", "Firestore", "Excel parsing"] },
  { label: "Tooling", items: ["Git", "GitHub Actions", "VS Code", "Claude Code", "n8n"] },
  { label: "RF / Hardware", items: ["Spectrum analyzer", "Power sensor", "FEM bring-up", "Bluetooth", "LoRa", "LTE / NB-IoT / CAT-M", "Antenna patterns"] },
];

export default function Stack() {
  return (
    <section id="stack" className={styles.section} aria-labelledby="stack-label">
      <div className="container">
        <div id="stack-label">
          <SectionLabel index="04">Stack</SectionLabel>
        </div>

        <div className={styles.grid}>
          {GROUPS.map((g, i) => (
            <div key={g.label} className={styles.group} data-reveal data-reveal-delay={(((i % 5) + 1)).toString()}>
              <h3 className={styles.groupLabel}>{g.label}</h3>
              <ul className={styles.chips}>
                {g.items.map((s) => (
                  <li key={s} className={styles.chip}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
