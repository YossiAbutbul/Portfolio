"use client";

import Link from "next/link";
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
    <header className={styles.nav}>
      {isProject ? (
        <Link href="/" className={styles.brand}><span aria-hidden="true">← </span>Back to YOSSI-1</Link>
      ) : (
        <Link href="/#top" className={styles.brand} onClick={(e) => go(e, "top")} aria-label="YOSSI-1, back to top">
          YOSSI-1
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
