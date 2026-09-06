"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./Gutter.module.css";

/**
 * The left rail.
 *
 * It is the continuation of the hero's offset column down the rest of the
 * page, and it is real navigation rather than a decorative scale: every
 * marker links to the section it addresses.
 *
 * It is also the progress indicator, which is why there is no bar across the
 * top of the page. The fill is scroll-linked in CSS and costs nothing. Which
 * section is current is state rather than motion, so it is an observer: three
 * or four callbacks over a whole page, no scroll handler.
 */

interface Stop {
  /** Address shown on the rail. Also the ordering. */
  offset: string;
  id: string;
  label: string;
}

const HOME_STOPS: Stop[] = [
  { offset: "0000", id: "hero", label: "Top" },
  { offset: "0040", id: "work", label: "Work" },
  { offset: "0080", id: "about", label: "About" },
  { offset: "00c0", id: "experience", label: "Experience" },
  { offset: "0100", id: "contact", label: "Contact" },
];

export default function Gutter() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!onHome) {
      setActive(null);
      return;
    }

    const sections = HOME_STOPS.map((stop) => document.getElementById(stop.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (!sections.length) return;

    /* Whichever section covers the middle of the viewport is the one being
       read. A band rather than a line, so a short section between two long
       ones still gets its turn. */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [onHome, pathname]);

  return (
    <nav className={styles.gutter} aria-label="Sections">
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} data-scroll="progress" />
      </span>

      <ol className={styles.stops}>
        {HOME_STOPS.map((stop) => (
          <li key={stop.id}>
            <Link
              href={onHome ? `#${stop.id}` : `/#${stop.id}`}
              className={styles.stop}
              data-active={active === stop.id ? "" : undefined}
              aria-current={active === stop.id ? "true" : undefined}
              prefetch={false}
            >
              <span className={styles.tick} aria-hidden="true" />
              <span className={`${styles.offset} figures`} aria-hidden="true">
                {stop.offset}
              </span>
              <span className={styles.name}>{stop.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
