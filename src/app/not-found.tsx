import Link from "next/link";
import { NOT_FOUND } from "@content/copy";
import styles from "./not-found.module.css";

export const metadata = {
  title: "Not found - Yossi Abutbul",
  description: "There is no page at this address.",
};

export default function NotFound() {
  return (
    <section className={styles.page}>
      <div className={`bay ${styles.bay}`}>
        <p className={`${styles.addr} figures`} aria-hidden="true">
          ffff
        </p>
        <h1 className={styles.title}>{NOT_FOUND.heading}</h1>
        <p className={styles.body}>{NOT_FOUND.body}</p>

        <p className={styles.actions}>
          <Link href="/" className={styles.action} prefetch={false}>
            Back to the top
          </Link>
          <Link href="/#work" className={styles.action} prefetch={false}>
            See the work
          </Link>
        </p>
      </div>
    </section>
  );
}
