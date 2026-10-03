"use client";

import { useState } from "react";
import styles from "./LaunchSections.module.css";

export interface Release {
  version: string;
  big: string;
  role: string;
  detail: string;
  tone: string;
}

/**
 * The release history as an accordion of coloured tiles: the open one grows and shows its role and
 * detail, the others narrow to their version and name. Pointing at, tapping, or tabbing to a tile
 * opens it, so nothing depends on hover. The last tile is the stack, in hand-picked groups.
 */
export default function ReleaseTiles({ releases, stack }: { releases: readonly Release[]; stack: { label: string; items: string[] }[] }) {
  const [open, setOpen] = useState(releases.length - 1);
  return (
    <ol className={styles.tiles}>
      {releases.map((r, i) => (
        <li key={r.version} className={styles.tile} data-tone={r.tone} data-open={i === open ? "" : undefined} onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(i); }}>
          <button type="button" className={styles.tileHit} aria-expanded={i === open} aria-controls={`release-${i}`} onClick={() => setOpen(i)} onFocus={() => setOpen(i)}>
            <span className={styles.cap}>{r.version}</span>
            <span className={styles.tileBig}>{r.big}</span>
          </button>
          <div className={styles.tileMore} id={`release-${i}`}>
            <div>
              <h3>{r.role}</h3>
              <p>{r.detail}</p>
            </div>
          </div>
        </li>
      ))}
      <li className={`${styles.tile} ${styles.stackTile}`} data-tone="ink">
        <span className={styles.cap}>Stack · in production</span>
        <dl className={styles.stackGroups}>
          {stack.map((g) => (
            <div key={g.label}>
              <dt>{g.label}</dt>
              <dd>
                <ul className={styles.chips}>
                  {g.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </li>
    </ol>
  );
}
