import type { Metadata } from "next";
import Link from "next/link";
import { ABOUT } from "@content/copy";
import { findPortrait } from "@/lib/assets";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "About - Yossi Abutbul",
  description:
    "RF and electronics integrator at Arad Technologies, computer science student at The Open University, and the person who writes the software in between.",
};

export default function AboutPage() {
  const portrait = findPortrait();

  return (
    <article className={styles.page}>
      <div className={`bay ${styles.head}`}>
        <h1 className={styles.title}>About</h1>
      </div>

      <div className={`bay ${styles.body}`}>
        <div className={styles.prose}>
          {ABOUT.body.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}

          <h2 className={styles.subhead}>What I am looking for</h2>
          <p>{ABOUT.looking}</p>
        </div>

        <aside className={styles.aside}>
          {portrait ? (
            <figure className={styles.portrait}>
              <img
                src={portrait}
                alt="Yossi Abutbul"
                width={800}
                height={1000}
                loading="lazy"
                decoding="async"
              />
            </figure>
          ) : (
            /* No photo yet. Rather than a placeholder frame, the space carries
               the same addressed index the rest of the site uses. */
            <p className={styles.noPhoto}>
              <span className="figures">0x00</span> No photo here yet.
            </p>
          )}

          <h2 className={styles.subhead}>Tools I actually use</h2>
          <dl className={styles.tools}>
            {Object.entries(ABOUT.tools).map(([group, items]) => (
              <div key={group}>
                <dt>{group}</dt>
                <dd>
                  <ul>
                    {items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>

          <Link href="/#work" className={styles.back} prefetch={false}>
            See the work
          </Link>
        </aside>
      </div>
    </article>
  );
}
