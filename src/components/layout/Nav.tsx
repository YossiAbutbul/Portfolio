"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";

interface NavLink {
  href: string;
  label: string;
  id: string;
  /** Additional section ids that should also mark this link active. */
  aliases?: string[];
}

const LINKS: NavLink[] = [
  { href: "/#about", label: "About", id: "about" },
  { href: "/#showcase", label: "Projects", id: "showcase", aliases: ["projects"] },
  { href: "/#experience", label: "Experience", id: "experience" },
  { href: "/#skills", label: "Stack", id: "skills" },
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

    // Poll via rAF. We re-query the section elements every frame because:
    //  (1) Lenis' programmatic scrolls don't reliably dispatch native scroll events;
    //  (2) AnimatePresence with key={pathname} unmounts and remounts the page on
    //      every soft-nav, so cached element refs become stale (a detached element
    //      reports getBoundingClientRect().top = 0, which collapses the algorithm
    //      onto the last-defined section — Contact).
    let raf = 0;
    let last: string | null | undefined = undefined;

    // Build flat list of (sectionId, linkId) pairs, ordered by DOM order.
    const tracked: { el: HTMLElement; linkId: string }[] = [];
    for (const l of LINKS) {
      const ids = [l.id, ...(l.aliases ?? [])];
      for (const sid of ids) {
        const el = document.getElementById(sid);
        if (el) tracked.push({ el, linkId: l.id });
      }
    }
    tracked.sort((a, b) => a.el.offsetTop - b.el.offsetTop);
    if (tracked.length === 0) return;
    const firstSection = tracked[0].el;
    function update() {
      const probe = window.innerHeight * 0.4;
      let firstTop: number | null = null;
      let next: string | null = null;
      for (const l of LINKS) {
        const ids = [l.id, ...(l.aliases ?? [])];
        for (const sid of ids) {
          const el = document.getElementById(sid);
          if (!el) continue;
          const top = el.getBoundingClientRect().top;
          if (firstTop === null) firstTop = top;
          if (top <= probe) next = l.id;
        }
      }
      let current: string | null = null;
      for (const t of tracked) {
        const top = t.el.getBoundingClientRect().top;
        if (firstTop === null) firstTop = top;
        if (top <= probe) current = t.linkId;
      }
      let next = current;
      if (firstTop === null || firstTop > probe) next = null;
      if (next !== last) {
        last = next;
        setActive(next);
      }
      }
    }

    function loop() {
      update();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isProject, pathname]);

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
          <Link
            href="/"
            className={styles.backLink}
            aria-label="Back to Projects"
            onClick={() => {
              try {
                sessionStorage.setItem("__navTarget", "showcase");
                // Saved scroll for "/" would otherwise override the target.
                sessionStorage.removeItem("scroll:/");
              } catch {}
            }}
          >
            <span className={styles.backArrow} aria-hidden="true">←</span>
            Back
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
              }
            }}
          >
            <span className={styles.monogramMark} aria-hidden="true">YA</span>
          </Link>
        )}

        <div className={styles.right}>
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
        </div>
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
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const id = href.replace(/^\/?#/, "");
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
      onClick={handleClick}
    >
      <span className={styles.linkText}>{label}</span>
    </a>
  );
}
