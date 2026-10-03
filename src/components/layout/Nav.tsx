"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";

const LINKS = [
  { href: "/#work", label: "Work", id: "work" },
  { href: "/#experience", label: "Experience", id: "experience" },
  { href: "/#contact", label: "Contact", id: "contact" },
];

// The sections the address follows as you scroll (the hero has none), and the link each one lights:
// More work is still Work.
const SECTIONS = ["work", "more-work", "experience", "contact"];
const LINK_OF: Record<string, string> = { "more-work": "work" };

/**
 * A transparent bar that inverts against whatever is behind it, so it reads on the desk, the dark
 * room and the cream page alike. Project pages get a way back instead of the section links.
 */
export default function Nav() {
  const pathname = usePathname();
  const isProject = pathname.startsWith("/projects/");
  const header = useRef<HTMLElement>(null);

  // Over a section marked data-nav="light" the bar switches to dark ink, and anywhere while some
  // element carries data-nav-force="light" (a 3D backdrop that is pale behind the bar, which no section
  // rect can describe). One passive listener, one rAF.
  useEffect(() => {
    let frame = 0, current: string | null | undefined;
    const check = () => {
      frame = 0;
      const el = header.current; if (!el) return;
      const y = el.getBoundingClientRect().bottom / 2;
      const light = !!document.querySelector("[data-nav-force='light']") || [...document.querySelectorAll<HTMLElement>("[data-nav='light']")].some((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom >= y; });
      el.dataset.tone = light ? "light" : "dark";
      // The address follows the section holding the middle of the screen (no hash over the hero), and
      // the bar marks its link. replaceState, so scrolling adds no history entries.
      if (isProject) return;
      const mid = innerHeight / 2;
      const at = SECTIONS.find((id) => { const s = document.getElementById(id)?.getBoundingClientRect(); return !!s && s.top <= mid && s.bottom > mid; }) ?? null;
      if (at !== current) {
        current = at;
        history.replaceState(history.state, "", at ? `#${at}` : location.pathname + location.search);
        el.querySelectorAll<HTMLAnchorElement>("a[data-section]").forEach((a) => {
          if (a.dataset.section === (at && (LINK_OF[at] ?? at))) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
        });
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("launch:nav", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); window.removeEventListener("launch:nav", schedule); };
  }, [pathname, isProject]);

  function go(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const el = document.getElementById(id);
    if (el) {
      e.preventDefault();
      if (window.__lenis) window.__lenis.scrollTo(el, { duration: 1.05 });
      else el.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", `#${id}`);
    } else {
      // Coming from another page: the home page scrolls here once it has mounted.
      try { sessionStorage.setItem("__navTarget", id); } catch {}
    }
  }

  return (
    <header ref={header} className={styles.nav}>
      {isProject ? (
        <Link href="/" className={styles.brand}><span aria-hidden="true">← </span>Back to Yossi Abutbul</Link>
      ) : (
        <Link href="/#top" className={styles.brand} data-brand onClick={(e) => go(e, "top")} aria-label="Yossi Abutbul, back to top">
          {/* The full name, or its initials on small screens. The hero's name flies to whichever shows. */}
          <span className={styles.full} data-brand-text>Yossi Abutbul</span>
          <span className={styles.short} data-brand-text aria-hidden="true">YA</span>
        </Link>
      )}
      <nav aria-label="Sections">
        <ul className={styles.links}>
          {LINKS.map((l) => (
            <li key={l.id}>
              <Link href={l.href} data-section={l.id} onClick={(e) => go(e, l.id)}>{l.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
