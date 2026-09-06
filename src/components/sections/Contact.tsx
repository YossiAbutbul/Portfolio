"use client";

import { useEffect, useState } from "react";
import { useForm, ValidationError } from "@formspree/react";
import { CONTACT } from "@content/copy";
import styles from "./Contact.module.css";

const PROFILES = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/yossi-abutbul-550958199/" },
  { label: "GitHub", href: "https://github.com/YossiAbutbul" },
  { label: "CV, PDF", href: "/Yossi Abutbul - CV 2026.pdf" },
];

export default function Contact() {
  return (
    <section id="contact" className={styles.contact} aria-labelledby="contact-title">
      <div className={`bay ${styles.bay}`}>
        <div>
          <h2 id="contact-title">{CONTACT.heading}</h2>
          <p className={styles.line}>{CONTACT.line}</p>

          <div className={styles.emailRow}>
            <a href={`mailto:${CONTACT.email}`} className={styles.email}>
              {CONTACT.email}
            </a>
            <CopyEmail value={CONTACT.email} />
          </div>

          <ul className={styles.profiles}>
            {PROFILES.map((profile) => (
              <li key={profile.href}>
                <a href={profile.href} target="_blank" rel="noreferrer">
                  {profile.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <ContactForm />
      </div>

      <p className={`bay ${styles.footer}`}>
        <span className="figures">&copy; {new Date().getFullYear()}</span> Yossi Abutbul
      </p>
    </section>
  );
}

function CopyEmail({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be refused. The address is right there as a
      // selectable mailto link, so there is nothing to recover from.
    }
  }

  return (
    <button
      type="button"
      className={styles.copy}
      onClick={copy}
      data-cursor="copy"
      data-copied={copied || undefined}
    >
      {copied ? "Copied" : "Copy"}
      {/* Announced without moving focus, so the state change is not silent. */}
      <span className="sr-only" role="status">
        {copied ? "Email address copied to clipboard" : ""}
      </span>
    </button>
  );
}

function ContactForm() {
  const [state, handleSubmit] = useForm("xwvzvjkb");

  if (state.succeeded) {
    return (
      <div className={styles.form} role="status">
        <p className={styles.sentTitle}>Message sent</p>
        <p className={styles.sentBody}>Thanks. I will reply to the address you gave.</p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <p className={styles.formTitle}>Or send a message</p>

      <div className={styles.field}>
        <label htmlFor="contact-name">Name</label>
        <input id="contact-name" name="name" type="text" autoComplete="name" required />
      </div>

      <div className={styles.field}>
        <label htmlFor="contact-email">Email</label>
        <input id="contact-email" name="email" type="email" autoComplete="email" required />
        <ValidationError
          prefix="Email"
          field="email"
          errors={state.errors}
          className={styles.error}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="contact-message">Message</label>
        <textarea id="contact-message" name="message" rows={5} required />
        <ValidationError
          prefix="Message"
          field="message"
          errors={state.errors}
          className={styles.error}
        />
      </div>

      <button
        type="submit"
        className={styles.submit}
        disabled={state.submitting}
        data-sending={state.submitting || undefined}
      >
        {state.submitting ? "Sending" : "Send"}
      </button>

      <ValidationError errors={state.errors} className={styles.error} />
    </form>
  );
}
