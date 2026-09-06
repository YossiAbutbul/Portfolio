import styles from "./SheetMarks.module.css";

/**
 * Sheet furniture.
 *
 * The marks a printer leaves on a page and trims off afterwards: crop marks at
 * the four corners, a registration target at the foot, and the punch holes a
 * datasheet has when it lives in a binder.
 *
 * They are pinned to the viewport rather than to the document, so the window
 * itself becomes the sheet you are holding. Everything here is hairline weight
 * and inert - it is the edge of the page, not an interface.
 */
export default function SheetMarks() {
  return (
    <div className={styles.marks} aria-hidden="true">
      <span className={`${styles.crop} ${styles.cropTopLeft}`} />
      <span className={`${styles.crop} ${styles.cropTopRight}`} />
      <span className={`${styles.crop} ${styles.cropBottomLeft}`} />
      <span className={`${styles.crop} ${styles.cropBottomRight}`} />

      <span className={styles.punches}>
        <span className={styles.punch} />
        <span className={styles.punch} />
        <span className={styles.punch} />
      </span>

      {/* Registration target: the mark a press uses to line one colour up
          against another, which is exactly what the highlighter fails to do. */}
      <svg className={styles.registration} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1" />
        <path d="M12 0v7.5M12 16.5V24M0 12h7.5M16.5 12H24" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  );
}
