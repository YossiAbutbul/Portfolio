"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";

const LINKS = [
  { href: "/#work", label: "Work", id: "work" },
  { href: "/#thermal", label: "Benchmarks", id: "thermal" },
  { href: "/#changelog", label: "Changelog", id: "changelog" },
  { href: "/#contact", label: "Contact", id: "contact" },
];

/**
 * A transparent bar that inverts against whatever is behind it, so it reads on the desk, the dark
 * room and the cream page alike. Project pages get a way back instead of the section links.
 */
export default function Nav() {
  const pathname = usePathname();
  const isProject = pathname.startsWith("/projects/");
  const header = useRef<HTMLElement>(null);

  // Over a section marked data-nav="light" the bar switches to dark ink. One passive listener, one rAF.
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = header.current; if (!el) return;
      const y = el.getBoundingClientRect().bottom / 2;
      const light = [...document.querySelectorAll<HTMLElement>("[data-nav='light']")].some((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom >= y; });
      el.dataset.tone = light ? "light" : "dark";
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [pathname]);

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
          Yossi Abutbul
        </Link>
      )}
      <nav aria-label="Sections">
        <ul className={styles.links}>
          {LINKS.map((l) => (
            <li key={l.id} className={l.id === "contact" ? styles.keep : undefined}>
              <Link href={l.href} onClick={(e) => go(e, l.id)}>{l.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
