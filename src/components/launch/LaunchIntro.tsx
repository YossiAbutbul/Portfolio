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
        {/* A cue, not a control: the arrow inside its ring keeps dropping, to say "scroll". */}
        <span className={styles.scroll} data-cue aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="11" />
            <g className={styles.cueArrow}><path d="M12 7v9" /><path d="m8 12 4 4 4-4" /></g>
          </svg>
        </span>
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
