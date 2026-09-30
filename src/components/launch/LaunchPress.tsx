"use client";

import { useEffect, useState } from "react";
import styles from "./LaunchSections.module.css";

/** Back on the desk: one real button that presses the device's button. */
export default function LaunchPress() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const onPress = (e: Event) => setCount((e as CustomEvent<number>).detail);
    window.addEventListener("launch:press", onPress);
    return () => window.removeEventListener("launch:press", onPress);
  }, []);

  return (
    <section className={`${styles.pin} ${styles.press}`} id="press" aria-labelledby="press-title">
      <div className={styles.frame}>
        <h2 className={styles.pressTitle} id="press-title">
          One button.<br />Zero drama.<span>Press it. It ships.</span>
        </h2>
        <div className={styles.pressControl}>
          <button className={styles.pill} type="button" onClick={() => window.dispatchEvent(new Event("launch:press-device"))}>
            Press
          </button>
          <span className={styles.mono} aria-live="polite">{count} shipped</span>
        </div>
      </div>
    </section>
  );
}
