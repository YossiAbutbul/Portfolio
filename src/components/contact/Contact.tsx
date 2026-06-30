import SectionLabel from "@/components/ui/SectionLabel";
import { withBasePath } from "@/lib/env";
import styles from "./Contact.module.css";

const EMAIL = "abyossi22@gmail.com";
const EMAIL_SUBJECT = "Hello — from your portfolio";
const EMAIL_BODY = [
  "Hi Yossi,",
  "",
  "I came across your portfolio and wanted to reach out.",
  "",
  "—",
  "",
].join("\r\n");
const MAILTO = `mailto:${EMAIL}?subject=${encodeURIComponent(EMAIL_SUBJECT)}&body=${encodeURIComponent(
  EMAIL_BODY,
)}`;

interface LinkRow {
  label: string;
  href: string;
  display: string;
  meta?: string;
  newTab?: boolean;
}

const CV_FILENAME = `Yossi Abutbul - CV ${new Date().getFullYear()}.pdf`;

const LINKS: LinkRow[] = [
  { label: "Phone", href: "tel:+972525476603", display: "+972 52-547-6603" },
  { label: "GitHub", href: "https://github.com/YossiAbutbul", display: "@YossiAbutbul" },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/yossi-abutbul-550958199/",
    display: "yossi-abutbul",
  },
  {
    label: "CV",
    href: withBasePath(`/${CV_FILENAME}`),
    display: "View CV",
    newTab: true,
  },
];

export default function Contact() {
  return (
    <section id="contact" className={styles.section} aria-labelledby="contact-label">
      <div className="container">
        <div id="contact-label">
          <SectionLabel index="05">Contact</SectionLabel>
        </div>

        <h2 className={styles.headline} data-reveal data-reveal-delay="1">
          Get in <em>touch</em>.
        </h2>

        <p className={styles.cta} data-reveal data-reveal-delay="3">
          <span className={styles.ctaPrefix}>Write me at </span>
          <a
            className={styles.ctaLink}
            href={MAILTO}
            target="_blank"
            rel="noreferrer noopener"
          >
            {EMAIL}
          </a>
          <span className={styles.ctaDot} aria-hidden="true">.</span>
        </p>

        <ul className={styles.list}>
          {LINKS.map((l, i) => (
            <li
              key={l.label}
              className={styles.row}
              data-reveal
              data-reveal-delay={(((i % 5) + 1)).toString()}
            >
              <span className={styles.rowLabel}>{l.label}</span>
              <a
                className={styles.rowValue}
                href={l.href}
                {...(l.href.startsWith("http") || l.newTab
                  ? { target: "_blank", rel: "noreferrer noopener" }
                  : {})}
              >
                <span className={styles.rowText}>{l.display}</span>
                {l.meta && <span className={styles.rowMeta}>[ {l.meta} ]</span>}
                <span className={styles.rowArrow} aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ul>

        <footer className={styles.footer}>
          <p>
            <span className={styles.footMono}>© {new Date().getFullYear()} Yossi Abutbul</span>
          </p>
        </footer>
      </div>
    </section>
  );
}
