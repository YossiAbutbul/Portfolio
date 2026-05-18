import Link from "next/link";
import FloorNoise from "@/components/ui/FloorNoise";
import styles from "./not-found.module.css";

export const metadata = {
  title: "Yossi Abutbul Portfolio - Not Found",
  description: "This page doesn't exist.",
};

export default function NotFound() {
  return (
    <section className={styles.page}>
      <div className={`container ${styles.inner}`}>
        <p className={styles.eyebrow}>error 404</p>

        <h1 className={styles.code} aria-label="404">
          4<span className={styles.zero}>0</span>4
        </h1>

        <p className={styles.headline}>Route not found.</p>

        <p className={styles.sub}>
          This URL compiled but never shipped.<br />
          No route, no page, no carrier. Head back.
        </p>

        <div className={styles.actions}>
          <Link href="/" className={styles.actionPrimary}>
            <span aria-hidden="true">←</span>
            Home
          </Link>
          <Link href="/#showcase" className={styles.actionGhost}>
            Projects
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>

      <FloorNoise />
    </section>
  );
}
