import MorphingTitle from "./MorphingTitle";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section id="hero" className={styles.hero} aria-labelledby="hero-name">
      <div className={`container ${styles.inner}`}>
        <p className={`eyebrow ${styles.eyebrow}`}>
          <span className={styles.dot} aria-hidden="true" />
          Portfolio · 2026
        </p>
        <div id="hero-name" className={styles.h1Wrap}>
          <MorphingTitle text="Yossi Abutbul" />
          <div className={styles.signal} aria-hidden="true">
            <svg viewBox="0 0 1200 40" preserveAspectRatio="none">
              <path
                className={styles.sweepA}
                d="M0 20 C 60 20, 100 4, 160 20 S 280 34, 340 20 S 460 6, 520 20 S 640 32, 700 20 S 820 8, 880 20 S 1000 30, 1060 20 S 1180 10, 1200 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                pathLength="1"
              />
              <path
                className={styles.sweepB}
                d="M0 22 L25 22 L35 14 L50 28 L65 18 L85 22 L100 10 L115 26 L135 20 L155 22 L175 14 L195 26 L220 22 L240 10 L260 24 L285 22 L310 16 L335 28 L360 20 L385 22 L415 12 L445 26 L475 20 L505 8 L535 24 L565 18 L600 22 L635 22 L665 14 L695 26 L725 18 L755 22 L785 10 L815 28 L845 20 L875 22 L905 16 L935 24 L965 22 L995 12 L1025 28 L1055 20 L1085 22 L1115 10 L1145 24 L1175 18 L1200 22"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                opacity="0.55"
                pathLength="1"
              />
              <circle
                className={styles.sample}
                cx="1190"
                cy="20"
                r="1.6"
                fill="var(--accent)"
              />
            </svg>
          </div>
        </div>
        <p className={styles.subtitle}>Building software where signals meet code.</p>
        <p className={styles.meta}>
          BSc Computer Science student at The Open University <span aria-hidden="true">·</span> Innovating with AI
        </p>
      </div>
    </section>
  );
}
