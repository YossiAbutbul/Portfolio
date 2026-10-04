"use client";

import { useRef } from "react";
import Privacy from "./Privacy";
import styles from "./PrivacyLink.module.css";

/** The footer's Privacy button: opens the privacy note in a modal over the page (native <dialog>:
 *  Esc closes it, focus moves in, the page behind is inert). */
export default function PrivacyLink({ className }: { className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const open = () => {
    dialog.current?.showModal();
    closeButton.current?.focus();
  };
  const close = () => dialog.current?.close();
  return (
    <>
      <button type="button" className={`${styles.trigger} ${className ?? ""}`} onClick={open} aria-haspopup="dialog">Privacy</button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="privacy-title"
        // A click on the backdrop lands on the dialog itself; inside, it lands on the card.
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        // Lenis would otherwise scroll the page under the modal.
        data-lenis-prevent=""
      >
        <div className={styles.card}>
          <button ref={closeButton} type="button" className={styles.close} onClick={close} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
          <Privacy headingId="privacy-title" />
        </div>
      </dialog>
    </>
  );
}
