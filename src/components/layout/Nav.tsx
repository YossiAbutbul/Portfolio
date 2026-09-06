"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";

/**
 * Header.
 *
 * Section tracking used to live here as a requestAnimationFrame poll. The
 * left rail owns section navigation now, so this is back to what a header is:
 * a way home and a short set of links.
 */

const LINKS = [
  { href: "/#work", label: "Work" },
  { href: "/about/", label: "About" },
  { href: "/#contact", label: "Contact" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = menuRef.current?.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled])",
    );
    requestAnimationFrame(() => focusable?.[0]?.focus());

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      buttonRef.current?.focus();
    };
  }, [open]);

  return (
    <header className={`vt-header ${styles.nav}`}>
      <div className={styles.inner}>
        {/* The visible text is part of the accessible name, so voice control
            can activate it by what it says. */}
        <Link href="/" className={styles.monogram} aria-label="YA, home" prefetch={false}>
          <span aria-hidden="true">YA</span>
        </Link>

        <nav
          ref={menuRef}
          id="primary-nav"
          className={`${styles.menu} ${open ? styles.menuOpen : ""}`}
          aria-label="Primary"
        >
          <ul className={styles.links}>
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={styles.link} prefetch={false}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          ref={buttonRef}
          className={styles.toggle}
          type="button"
          aria-expanded={open}
          aria-controls="primary-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
    </header>
  );
}
