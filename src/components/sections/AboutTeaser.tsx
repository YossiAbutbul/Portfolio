import Link from "next/link";
import { ABOUT } from "@content/copy";
import styles from "./AboutTeaser.module.css";

export default function AboutTeaser({ portrait }: { portrait?: string | null }) {
  return (
    <section id="about" className={styles.about} aria-labelledby="about-title">
      <div className={`bay ${styles.bay}`}>
        <div>
          <h2 id="about-title">{ABOUT.heading}</h2>
          <p className={styles.teaser}>{ABOUT.teaser}</p>
          <Link href="/about/" className={styles.more} prefetch={false}>
            Read the longer version
          </Link>
        </div>

        {portrait && (
          <figure className={styles.portrait}>
            <img
              src={portrait}
              alt="Yossi Abutbul"
              width={800}
              height={1000}
              loading="lazy"
              decoding="async"
            />
          </figure>
        )}
      </div>
    </section>
  );
}
