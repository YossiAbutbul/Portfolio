"use client";

import { useForm, ValidationError } from "@formspree/react";
import { useEffect, useState } from "react";
import SectionLabel from "@/components/ui/SectionLabel";
import { withBasePath } from "@/lib/env";
import styles from "./Contact.module.css";

const FORMSPREE_ID = "xwvzvjkb";
const CV_FILENAME = `Yossi Abutbul - CV ${new Date().getFullYear()}.pdf`;

interface LinkRow { label: string; href: string; display: string; newTab?: boolean; }

const LINKS: LinkRow[] = [
  { label: "Phone",    href: "tel:+972525476603",                                     display: "+972 52-547-6603" },
  { label: "GitHub",   href: "https://github.com/YossiAbutbul",                      display: "@YossiAbutbul",   newTab: true },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/yossi-abutbul-550958199/", display: "yossi-abutbul",   newTab: true },
  { label: "CV",       href: withBasePath(`/${CV_FILENAME}`),                         display: "View CV",         newTab: true },
];

const RESET_DELAY = 5000; // ms before form reappears after success

export default function Contact() {
  const [state, handleSubmit] = useForm(FORMSPREE_ID);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!state.succeeded) return;
    setShowSuccess(true);
    const t = setTimeout(() => setShowSuccess(false), RESET_DELAY);
    return () => clearTimeout(t);
  }, [state.succeeded]);

  return (
    <section id="contact" className={styles.section} aria-labelledby="contact-label">
      <div className="container">

        {/* ── Section label + headline above grid ── */}
        <div id="contact-label">
          <SectionLabel index="05">Contact</SectionLabel>
        </div>
        <div className={styles.header}>
          <h2 className={styles.headline} data-reveal data-reveal-delay="1">
            Get in <em>touch</em>.
          </h2>
          <p className={styles.lede} data-reveal data-reveal-delay="2">
            Have a project in mind or just want to say hi?
            Fill out the form or reach me directly.
          </p>
        </div>

        {/* ── Two-column grid: links | form ── */}
        <div className={styles.grid}>

          {/* Left: links */}
          <ul className={styles.list}>
            {LINKS.map((l, i) => (
              <li
                key={l.label}
                className={styles.row}
                data-reveal
                data-reveal-delay={(((i % 4) + 1)).toString()}
              >
                <span className={styles.rowLabel}>{l.label}</span>
                <a
                  className={styles.rowValue}
                  href={l.href}
                  {...(l.href.startsWith("http") || l.newTab
                    ? { target: "_blank", rel: "noreferrer noopener" }
                    : {})}
                >
                  <span className={styles.rowText}>{l.display}</span>
                  <span className={styles.rowArrow} aria-hidden="true">→</span>
                </a>
              </li>
            ))}
          </ul>

          {/* Right: form / success */}
          <div className={styles.right} data-reveal data-reveal-delay="2">
            {showSuccess ? (
              <div className={styles.success}>
                <span className={styles.successIcon} aria-hidden="true">✓</span>
                <p className={styles.successTitle}>Message sent.</p>
                <p className={styles.successSub}>I&apos;ll get back to you shortly.</p>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="cf-name">Name</label>
                    <input id="cf-name" name="name" className={styles.input}
                      type="text" placeholder="Jane Smith" autoComplete="name" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="cf-email">
                      Email <span className={styles.required} aria-hidden="true">*</span>
                    </label>
                    <input id="cf-email" name="email" className={styles.input}
                      type="email" placeholder="hello@example.com" required autoComplete="email" />
                    <ValidationError field="email" prefix="Email" errors={state.errors} className={styles.errMsg} />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="cf-subject">Subject</label>
                  <input id="cf-subject" name="subject" className={styles.input}
                    type="text" placeholder="What's this about?" />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="cf-message">Message</label>
                  <textarea id="cf-message" name="message"
                    className={`${styles.input} ${styles.textarea}`}
                    placeholder="Tell me more…" rows={5} />
                  <ValidationError field="message" prefix="Message" errors={state.errors} className={styles.errMsg} />
                </div>

                <div className={styles.formFooter}>
                  <button type="submit" className={styles.btnSubmit} disabled={state.submitting}>
                    {state.submitting ? "Sending…" : <>Send message <span aria-hidden="true">→</span></>}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

        <footer className={styles.footer}>
          <span className={styles.footMono}>© {new Date().getFullYear()} Yossi Abutbul</span>
        </footer>
      </div>
    </section>
  );
}
