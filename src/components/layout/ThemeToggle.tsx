"use client";

import { useTheme } from "@/hooks/useTheme";
import styles from "./ThemeToggle.module.css";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
      onClick={toggle}
    >
      <span className={`${styles.thumb} ${isDark ? styles.thumbDark : styles.thumbLight}`} aria-hidden="true">
        {isDark ? (
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M13 9.2A5 5 0 0 1 6.8 3a5 5 0 1 0 6.2 6.2z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="8" cy="8" r="3" fill="currentColor" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </button>
  );
}
