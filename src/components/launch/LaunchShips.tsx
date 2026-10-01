import styles from "./LaunchIntro.module.css";

/** The beat where "it ships." slides behind the turning device. The word itself lives in the stage. */
export default function LaunchShips() {
  return (
    <section className={`${styles.pin} ${styles.shipsPin}`} id="ships" aria-label="It ships">
      <div className={styles.frame}>
        <span className={`${styles.shipsKick} ${styles.fade}`} data-fade>Built, tested, then</span>
        <p className={styles.srOnly}>Built, tested, then it ships.</p>
      </div>
    </section>
  );
}
