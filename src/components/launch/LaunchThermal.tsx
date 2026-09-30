"use client";

import { useEffect, useState } from "react";
import styles from "./LaunchSections.module.css";

const BEFORE = 4320, AFTER = 8;

/**
 * Test Console's real before/after, told as a thermal camera. Scroll cools the device down; the
 * slider does the same by hand. The numbers are the only claim, and they are in the text too.
 */
export default function LaunchThermal() {
  const [value, setValue] = useState(0);
  useEffect(() => {
    // The scene moves the slider with scroll; this keeps the readout in step with it.
    const onHeat = (e: Event) => setValue((e as CustomEvent<number>).detail);
    window.addEventListener("launch:heat", onHeat);
    return () => window.removeEventListener("launch:heat", onHeat);
  }, []);
  const minutes = Math.max(AFTER, Math.round(BEFORE + (AFTER - BEFORE) * (value / 100)));

  return (
    <section className={`${styles.pin} ${styles.thermal}`} id="thermal" aria-labelledby="thermal-title">
      <div className={styles.frame}>
        <div className={styles.duo}>
          <h2 id="thermal-title" className={styles.fade} data-fade>Handles<br />extremes<br />with ease</h2>
          <p className={styles.fade} data-fade>
            It used to take three days of manual testing to qualify one unit. Test Console runs the
            same procedure in about eight minutes.
          </p>
        </div>
        <div className={styles.scale} aria-hidden="true">
          <span className={styles.mono} style={{ top: -4 }}>3 DAYS</span>
          <span className={styles.mono} style={{ bottom: -4 }}>~8 MIN</span>
        </div>
        <div className={styles.formula}>
          <span className={`${styles.cap} ${styles.dim}`}>Thermal qualification model</span>
          <h3>Before<br />/ after</h3>
        </div>
        <div className={styles.control}>
          <label className={styles.cap} htmlFor="launch-heat">Drag: manual → automated</label>
          <input
            id="launch-heat"
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(+e.target.value)}
            aria-valuetext={`${minutes.toLocaleString()} minutes`}
          />
          <span className={styles.mono} aria-live="polite">
            {value < 50 ? "Manual" : "Test Console"} · {minutes.toLocaleString()} min
          </span>
        </div>
      </div>
    </section>
  );
}
