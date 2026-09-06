import { EXPERIENCE, span } from "@content/experience";
import styles from "./Experience.module.css";

/**
 * Work, degree and service on one rail.
 *
 * This is chronological, so the ordering carries information and the rail
 * earns its markers. It is the only place other than the project list where
 * the site numbers anything.
 */
export default function Experience() {
  return (
    <section id="experience" className={styles.experience} aria-labelledby="experience-title">
      <div className={`bay ${styles.bay}`}>
        <h2 id="experience-title">Where I have been</h2>

        <ol className={styles.list}>
          {EXPERIENCE.map((post) => (
            <li key={`${post.from}-${post.role}`} className={styles.post}>
              <div className={styles.when}>
                <span className={`${styles.years} figures`}>{span(post)}</span>
                <span className={styles.kind}>{post.kind}</span>
              </div>

              <div className={styles.what}>
                <h3 className={styles.role}>{post.role}</h3>
                <p className={styles.place}>{post.place}</p>
                <p className={styles.detail}>{post.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
