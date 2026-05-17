import styles from "./SectionLabel.module.css";

export default function SectionLabel({
  index,
  children,
}: {
  index: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.wrap} data-reveal>
      <span className={styles.index}>{index}</span>
      <span className={styles.label}>{children}</span>
    </div>
  );
}
