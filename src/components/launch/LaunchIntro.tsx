import styles from "./LaunchIntro.module.css";

/**
 * The desk hero and the spotlight beat after it. Plain markup: every word here is readable before
 * the scene loads, and with reduced motion the pinned beat collapses into a normal section.
 */
export default function LaunchIntro() {
  return (
    <>
      <section className={styles.hero} id="top" aria-labelledby="hero-name">
        <h1 className={styles.word} id="hero-name">Yossi Abutbul</h1>
        <div className={styles.card} data-card>
          <p className={styles.cardHead} data-lines>Takes a problem in. Ships software out.</p>
          <p className={styles.cardBody} data-lines>
            I take a problem apart and ship what fixes it, so the slow part of someone&apos;s day
            disappears.
          </p>
        </div>
        <a className={`${styles.scroll} ${styles.cap}`} href="#intro">
          <i aria-hidden="true">↓</i>Scroll to continue
        </a>
      </section>

      <section className={styles.pin} id="intro" aria-labelledby="intro-title">
        <div className={styles.frame}>
          <div className={styles.duo}>
            <h2 id="intro-title" className={styles.fade} data-fade>
              I build<br />what&apos;s missing.
            </h2>
            <p className={styles.fade} data-fade>
              When something at work or at home takes too long, I make the tool that fixes it: the
              UI, the API, the data, and the drivers when there&apos;s hardware.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
