"use client";

import Link from "next/link";
import { useState } from "react";
import { CV_PDF, countCvDownload } from "@/lib/cv";
import { say } from "./LaunchToast";
import styles from "./LaunchSections.module.css";

const EMAIL = "abyossi22@gmail.com";

/** Each panel's mark, large, standing over its name: the envelope, GitHub's and LinkedIn's marks, and a page for
 *  the CV. Solid, in the panel's text colour (cream on every panel). */
function Mark({ kind }: { kind: "mail" | "github" | "linkedin" | "cv" }) {
  return (
    <svg className={styles.panelIcon} viewBox="0 0 24 24" width="64" height="64" aria-hidden="true">
      {kind === "mail" && (
        <path fill="currentColor" fillRule="evenodd" d="M4 4.5h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Zm-.35 2.9L12 13.6l8.35-6.2-1.2-1.6L12 11.1 4.85 5.8Z" />
      )}
      {kind === "github" && (
        <path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
      )}
      {kind === "linkedin" && (
        <path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
      )}
      {kind === "cv" && (
        <path fill="currentColor" fillRule="evenodd" d="M6.5 2H14l5.5 5.5V20a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.8V8h4.2ZM8.25 12a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5Zm0 3.5a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5Z" />
      )}
    </svg>
  );
}

/**
 * Contact: a heading on the cream, then four coloured panels. Each says what it is (big), what a
 * click does (top), and where it goes (bottom); the email one copies the address and says so.
 */
export default function LaunchContact() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true); say("Email copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch { window.location.href = `mailto:${EMAIL}`; }
  }
  const top = (n: string, action: string) => (
    <span className={styles.panelTop}><span className={styles.cap}><b>{n}</b>{action}</span></span>
  );
  return (
    <>
      <section id="contact" aria-labelledby="contact-title" className={styles.contact} data-nav="light">
        <div className={styles.contactHead}>
          <h2 className={styles.big} id="contact-title">contact</h2>
        </div>
        <ul className={styles.panels}>
          <li>
            <button className={styles.panel} type="button" onClick={copy}>
              {top("01", copied ? "Copied ✓" : "Copy address")}
              <span><Mark kind="mail" /><span className={styles.panelWord}>Email</span><span className={styles.panelDetail}>{EMAIL}</span></span>
            </button>
          </li>
          <li>
            <a className={styles.panel} href="https://github.com/YossiAbutbul" target="_blank" rel="noreferrer">
              {top("02", "Browse the code")}
              <span><Mark kind="github" /><span className={styles.panelWord}>GitHub</span><span className={styles.panelDetail}>github.com/YossiAbutbul</span></span>
            </a>
          </li>
          <li>
            <a className={styles.panel} href="https://www.linkedin.com/in/yossi-abutbul-550958199/" target="_blank" rel="noreferrer">
              {top("03", "Message me")}
              <span><Mark kind="linkedin" /><span className={styles.panelWord}>LinkedIn</span><span className={styles.panelDetail}>in/yossi-abutbul</span></span>
            </a>
          </li>
          <li>
            <a className={styles.panel} href={CV_PDF} download onClick={countCvDownload}>
              {top("04", "Download PDF")}
              <span><Mark kind="cv" /><span className={styles.panelWord}>CV</span><span className={styles.panelDetail}>Updated September 2026</span></span>
            </a>
          </li>
        </ul>
      </section>
      <footer className={`${styles.footer} ${styles.cap}`}>
        <span>Yossi Abutbul · 2026</span>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </>
  );
}
