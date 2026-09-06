"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Gutter.module.css";

/**
 * The left rail.
 *
 * It is the continuation of the hero's offset column down the rest of the
 * page, and it is real navigation rather than a decorative scale: every
 * marker is a link to the section it addresses. The fill that tracks reading
 * position arrives with the motion pass; this renders the resting state.
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

  return (
    <nav className={styles.gutter} aria-label="Sections">
      <ol className={styles.stops}>
        {HOME_STOPS.map((stop) => (
          <li key={stop.id}>
            <Link
              href={onHome ? `#${stop.id}` : `/#${stop.id}`}
              className={styles.stop}
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
