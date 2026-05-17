import styles from "./SpecCard.module.css";

interface Row {
  k: string;
  v: string;
}

const ROWS: Row[] = [
  { k: "Role",    v: "Full-stack engineer" },
  { k: "Langs",   v: "TypeScript · Python · C" },
  { k: "Front",   v: "React · Next.js · Vite" },
  { k: "Back",    v: "FastAPI · Firebase · n8n" },
  { k: "Systems", v: "xv6 · RISC-V · Make · GDB" },
  { k: "RF",      v: "SA · Power sensor · FEM" },
  { k: "Proto",   v: "Bluetooth · LoRa · LTE · NB-IoT" },
  { k: "Ships",   v: "11 projects · open source" },
  { k: "Based",   v: "Israel" },
];

export default function SpecCard() {
  return (
    <aside className={styles.card} aria-label="Engineer specifications">
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <span className={styles.partLabel}>ENGINEER</span>
          <span className={styles.partNum}>YA-2026.01</span>
        </div>
        <span className={styles.status}>
          <span className={styles.statusDot} />
          AVAILABLE
        </span>
      </header>

      <dl className={styles.specs}>
        {ROWS.map((r) => (
          <div key={r.k} className={styles.row}>
            <dt className={styles.dt}>{r.k}</dt>
            <dd className={styles.dd}>{r.v}</dd>
          </div>
        ))}
      </dl>

      <footer className={styles.foot}>
        <span>// ready for product · platform · automation</span>
      </footer>
    </aside>
  );
}
