import styles from "./LaunchIntro.module.css";

/** The beat where "it ships." slides behind the turning device. The word itself lives in the stage. */
export default function LaunchShips() {
  return (
    <section className={`${styles.pin} ${styles.shipsPin}`} id="ships" aria-label="It ships">
      <div className={styles.frame}>
        <span className={`${styles.shipsKick} ${styles.fade}`} data-fade>So complete,</span>
        <p className={styles.srOnly}>So complete, it ships.</p>
      </div>
    </section>
  );
}
