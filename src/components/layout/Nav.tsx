"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { scrambleText } from "@/lib/scramble";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import styles from "./Nav.module.css";

const LINKS = [
  { href: "/#about", label: "About", id: "about" },
  { href: "/#projects", label: "Projects", id: "projects" },
  { href: "/#experience", label: "Experience", id: "experience" },
  { href: "/#skills", label: "Skills", id: "skills" },
  { href: "/#contact", label: "Contact", id: "contact" },
];

export default function Nav() {
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isProject = pathname.startsWith("/projects/");

  useEffect(() => {
    if (isProject) {
      setActive(null);
      return;
    }
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter(
      (el): el is HTMLElement => !!el,
    );
    if (sections.length === 0) return;

    const firstSection = sections[0];

    // Scroll-position spy: pick the section whose top has passed a probe
    // line 40% down the viewport. getBoundingClientRect is used instead of
    // offsetTop so the measurement is always viewport-relative and immune to
    // positioned-ancestor offset chains.
    function update() {
      const probe = window.innerHeight * 0.4;
      if (firstSection.getBoundingClientRect().top > probe) {
        setActive(null);
        return;
      }
      let current: string | null = null;
      for (const s of sections) {
        if (s.getBoundingClientRect().top <= probe) current = s.id;
      }
      if (current) setActive(current);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isProject]);

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
          <Link href="/#projects" className={`link-inline ${styles.backLink}`} aria-label="Back to Projects">
            <span className={styles.backArrow} aria-hidden="true">←</span>
            Back to Projects
          </Link>
        ) : (
          <Link
            href="/"
            className={styles.monogram}
            aria-label="Home — Yossi Abutbul"
            onClick={(e) => {
              if (pathname === "/") {
                e.preventDefault();
                if (window.__lenis) {
                  window.__lenis.scrollTo(0, { duration: 1.2 });
                } else {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              } else {
                sessionStorage.removeItem("scroll:/");
              }
            }}
          >
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
    const el = ref.current;
    // Pin pixel width only during scramble so flex siblings don't shift,
    // then release it so width reflects the actual label (which may change
    // between renders).
    el.style.width = `${el.getBoundingClientRect().width}px`;
    const handle = scrambleText(el, label, { duration: 500 });
    window.setTimeout(() => {
      handle.stop();
      el.style.width = "";
    }, 520);
  }

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const id = href.replace(/^\/?#/, ""); // "/#about" → "about"
    const el = document.getElementById(id);
    if (el) {
      if (window.__lenis) {
        window.__lenis.scrollTo(el, { offset: -16, duration: 1.4 });
      } else {
        el.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      window.location.href = base + href;
    }
    onNavigate();
  }

  return (
    <a
      href={href}
      className={`${styles.link} ${active ? styles.linkActive : ""}`}
      onPointerEnter={handleEnter}
      onFocus={handleEnter}
      onClick={handleClick}
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
