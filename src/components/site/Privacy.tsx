import styles from "./Privacy.module.css";

const EMAIL = "abyossi22@gmail.com";

/** What the site collects: a title, then one short row per thing kept.
 *  Shared by the footer's modal (heading h2) and the /privacy page (heading h1). */
export default function Privacy({ heading: H = "h2", headingId }: { heading?: "h1" | "h2"; headingId?: string }) {
  return (
    <div className={styles.sheet}>
      <H id={headingId} className={styles.title}>Privacy</H>
      <dl className={styles.rows}>
        <div>
          <dt>Visits</dt>
          <dd>Anonymous visit counts and page speed, so I know what people read. No cookies, nothing that identifies you.</dd>
        </div>
        <div>
          <dt>Hosting</dt>
          <dd>The host keeps standard technical logs to run and secure the site.</dd>
        </div>
        <div>
          <dt>Your device</dt>
          <dd>A couple of display settings are saved in your browser and never leave it.</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>
            If you write to me, your message is used only to reply.{" "}
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </dd>
        </div>
      </dl>
    </div>
  );
}
