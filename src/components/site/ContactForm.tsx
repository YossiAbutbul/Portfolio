"use client";

import { useForm, ValidationError } from "@formspree/react";
import styles from "./ContactForm.module.css";

/**
 * Formspree takes the submission, because the site is a static export and has
 * no server of its own to post to. The id is public by design. It identifies
 * the form and authorises nothing, so it ships in the bundle.
 */
const FORM_ID = process.env.NEXT_PUBLIC_FORMSPREE_FORM_ID ?? "";

export default function ContactForm({ email }: { email: string }) {
  // Hooks cannot be conditional, so an unconfigured form still calls this and
  // simply never submits through it; the fallback below takes over instead.
  const [state, submit] = useForm(FORM_ID || "unconfigured");
  const configured = FORM_ID.length > 0;

  if (state.succeeded) {
    return (
      <div className={styles.sent} data-rise>
        <p className={styles.sentTitle}>Message sent.</p>
        <p className={styles.sentBody}>
          It reaches the same inbox as {email}. I read everything and reply to anything that
          needs one, usually within a day or two.
        </p>
      </div>
    );
  }

  /**
   * Without an id there is nowhere to post, so the form hands the same three
   * fields to the reader's own mail client rather than pretending to send and
   * dropping the message on the floor.
   */
  function handOff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "");
    const body = `${String(data.get("message") ?? "")}\n\nFrom ${name} (${String(data.get("email") ?? "")})`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(`Portfolio: ${name}`)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form className={styles.form} onSubmit={configured ? submit : handOff} data-rise>
      <div className={styles.pair}>
        <div className={styles.field}>
          <label className={`mono ${styles.label}`} htmlFor="contact-name">
            Name
          </label>
          <input
            className={styles.input}
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={`mono ${styles.label}`} htmlFor="contact-email">
            Email
          </label>
          <input
            className={styles.input}
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
          <ValidationError className={styles.error} prefix="Email" field="email" errors={state.errors} />
        </div>
      </div>

      <div className={styles.field}>
        <label className={`mono ${styles.label}`} htmlFor="contact-message">
          Message
        </label>
        <textarea
          className={styles.textarea}
          id="contact-message"
          name="message"
          rows={5}
          placeholder="What you are working on, and where I might help."
          required
        />
        <ValidationError className={styles.error} prefix="Message" field="message" errors={state.errors} />
      </div>

      <div className={styles.actions}>
        <button className={styles.submit} type="submit" disabled={state.submitting}>
          {state.submitting && <span className={styles.pulse} aria-hidden="true" />}
          {state.submitting ? "Sending" : "Send"}
          {!state.submitting && <span className={styles.chevron} aria-hidden="true">&raquo;</span>}
        </button>
        <span className={`mono ${styles.note}`}>
          {configured ? "Goes straight to my inbox." : "Opens in your mail client."}
        </span>
      </div>

      <ValidationError className={styles.error} errors={state.errors} />
    </form>
  );
}
