import styles from "./LaunchIntro.module.css";

/**
 * The desk hero and the spotlight beat after it. Plain markup: every word here is readable before
 * the scene loads, and with reduced motion the pinned beat collapses into a normal section.
 */
export default function LaunchIntro() {
  return (
    <>
      <section className={styles.hero} id="top" aria-labelledby="hero-name">
        <span className={styles.kicker}>Takes a problem in. Ships software out.</span>
        <h1 className={styles.word} id="hero-name">Yossi Abutbul</h1>
        <p className={styles.side}>
          I take a problem apart and ship what fixes it, so the slow part of someone&apos;s day
          disappears.
        </p>
        <a className={`${styles.scroll} ${styles.cap}`} href="#intro">
          <i aria-hidden="true">↓</i>Scroll to continue
        </a>
      </section>

      <section className={styles.pin} id="intro" aria-labelledby="intro-title">
        <div className={styles.frame}>
          <div className={styles.duo}>
            <h2 id="intro-title" className={styles.fade} data-fade>
              Isn&apos;t just<br />a gadget.
            </h2>
            <p className={styles.fade} data-fade>
              It&apos;s a person. Yossi Abutbul designs, builds and ships software end to end:
              interface, backend, data, and drivers when there is hardware.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
