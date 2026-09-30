"use client";

import { withBasePath } from "@/lib/env";
import { say } from "./LaunchToast";
import styles from "./LaunchSections.module.css";

const EMAIL = "abyossi22@gmail.com";
const CV_HREF = "/Yossi Abutbul - CV 2026.pdf";

/** Four coloured panels: copy the email, or go to GitHub, LinkedIn or the CV. */
export default function LaunchContact() {
  async function copy() {
    try { await navigator.clipboard.writeText(EMAIL); say("Email copied"); }
    catch { window.location.href = `mailto:${EMAIL}`; }
  }
  return (
    <>
      <section id="contact" aria-labelledby="contact-title" style={{ position: "relative", zIndex: 2 }}>
        <h2 id="contact-title" className={styles.srOnly}>Contact</h2>
        <ul className={styles.panels}>
          <li>
            <button className={styles.panel} type="button" onClick={copy}>
              <span className={styles.cap}>Email</span>
              <span><span className={styles.panelWord}>Write</span><span className={styles.panelDetail}>{EMAIL} · copy</span></span>
            </button>
          </li>
          <li>
            <a className={styles.panel} href="https://github.com/YossiAbutbul" target="_blank" rel="noreferrer">
              <span className={styles.cap}>GitHub</span>
              <span><span className={styles.panelWord}>Code</span><span className={styles.panelDetail}>YossiAbutbul ↗</span></span>
            </a>
          </li>
          <li>
            <a className={styles.panel} href="https://www.linkedin.com/in/yossi-abutbul-550958199/" target="_blank" rel="noreferrer">
              <span className={styles.cap}>LinkedIn</span>
              <span><span className={styles.panelWord}>Connect</span><span className={styles.panelDetail}>yossi-abutbul ↗</span></span>
            </a>
          </li>
          <li>
            <a className={styles.panel} href={withBasePath(CV_HREF)} download>
              <span className={styles.cap}>Spec sheet</span>
              <span><span className={styles.panelWord}>CV</span><span className={styles.panelDetail}>PDF · September 2026</span></span>
            </a>
          </li>
        </ul>
      </section>
      <footer className={`${styles.footer} ${styles.cap}`}>
        <span>YOSSI-1 · single unit · 2026</span>
        <a href="#top">Back to top</a>
      </footer>
    </>
  );
}
