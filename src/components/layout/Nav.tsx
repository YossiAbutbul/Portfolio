"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { scrambleText } from "@/lib/scramble";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import styles from "./Nav.module.css";

const LINKS = [
  { href: "#about", label: "About", id: "about" },
  { href: "#work", label: "Work", id: "work" },
  { href: "#skills", label: "Skills", id: "skills" },
  { href: "#experience", label: "Experience", id: "experience" },
  { href: "#contact", label: "Contact", id: "contact" },
];

export default function Nav() {
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isProject = pathname.startsWith("/projects/");

  useEffect(() => {
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter(
      (el): el is HTMLElement => !!el,
    );
    if (sections.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.2, 0.6] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={styles.nav}>
      <div className={`container ${styles.inner}`}>
        {isProject ? (
          <Link href="/#work" className={`link-inline ${styles.backLink}`} aria-label="Back to work">
            <span className={styles.backArrow} aria-hidden="true">←</span>
            back to work
          </Link>
        ) : (
          <Link href="/" className={styles.monogram} aria-label="Home — Yossi Abutbul">
            <span aria-hidden="true">Yossi Abutbul</span>
            <span className={styles.monogramDot} aria-hidden="true" />
          </Link>
        )}

        <button
          className={styles.menuBtn}
          type="button"
          aria-expanded={open}
          aria-controls="primary-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`${styles.menuBar} ${open ? styles.menuBarOpen : ""}`} aria-hidden="true" />
          <span className={`${styles.menuBar} ${open ? styles.menuBarOpen : ""}`} aria-hidden="true" />
        </button>

        <nav
          id="primary-nav"
          className={`${styles.navWrap} ${open ? styles.navWrapOpen : ""}`}
          aria-label="Primary"
        >
          <ul className={styles.links}>
            {LINKS.map((l) => (
              <li key={l.href}>
                <NavLink
                  href={l.href}
                  label={l.label}
                  active={active === l.id}
                  onNavigate={() => setOpen(false)}
                />
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  function handleEnter() {
    if (!ref.current) return;
    if (prefersReducedMotion()) return;
    scrambleText(ref.current, label, { duration: 260 });
  }

  return (
    <a
      href={href}
      className={`${styles.link} ${active ? styles.linkActive : ""}`}
      onPointerEnter={handleEnter}
      onFocus={handleEnter}
      onClick={onNavigate}
    >
      <span className={styles.linkMarker} aria-hidden="true">
        {active ? "●" : ""}
      </span>
      <span ref={ref} className={styles.linkText}>
        {label}
      </span>
    </a>
  );
}
