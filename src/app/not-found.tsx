import Link from "next/link";
import styles from "./not-found.module.css";

export const metadata = {
  title: "Not found - Yossi Abutbul",
  description: "This page doesn't exist.",
};

export default function NotFound() {
  return (
    <section className={styles.page}>
      <div className={`container ${styles.inner}`}>
        <span className={`mono ${styles.stamp}`}>Error 404</span>
        <h1 className={styles.code}>404</h1>
        <p className={styles.headline}>No page at this address.</p>
        <p className={styles.sub}>
          The URL resolved, but nothing was ever published here.
        </p>
        <div className={styles.actions}>
          <Link href="/" className={styles.primary}>
            Back to start
          </Link>
          <Link href="/#work" className={styles.ghost}>
            Selected work
          </Link>
        </div>
      </div>
    </section>
  );
}
