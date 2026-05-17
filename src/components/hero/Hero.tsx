import InlineWaves from "./InlineWaves";
import HeroSineBg from "./HeroSineBg";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section id="hero" className={styles.hero} aria-labelledby="hero-name">
      <HeroSineBg />
      <div className={`container ${styles.layout}`}>
        <div className={styles.copy}>
          <h1 id="hero-name" className={styles.title}>
            Yossi <span className={styles.titleAccent}>Abutbul</span>
          </h1>

          <p className={styles.tagline}>
            <span className={styles.taglineInner}>
              <span className={styles.taglinePrefix}>Building software where </span>
              <span className={styles.taglineBridge}>
                <span className={styles.kw}>signals</span>
                <InlineWaves />
                <span className={styles.kw}>code</span>.
              </span>
            </span>
          </p>

          <p className={styles.meta}>
            <span className={styles.metaLine}>BSc Computer Science Student · The Open University</span>
            <span className={styles.metaLine}>Innovating With AI</span>
          </p>

          <div className={styles.cta}>
            <a className={styles.ctaPrimary} href="#projects">See work</a>
            <a className={styles.ctaGhost} href="#contact">Get in touch</a>
          </div>
        </div>
      </div>
    </section>
  );
}
