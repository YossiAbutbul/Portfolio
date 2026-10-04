import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy - Yossi Abutbul",
  description: "What this site collects: anonymous, cookieless visit counts and page speed. Nothing else.",
};

// Plain facts about what the site collects; reuses the 404 page's layout classes from globals.css.
export default function PrivacyPage() {
  return (
    <section className="nf-page">
      <div className="container nf-inner">
        <span className="mono nf-stamp">Privacy · Updated October 2026</span>
        <h1 className="nf-headline">No cookies, no ads, no accounts.</h1>
        <ul className="nf-sub privacy-list">
          <li>
            Visits are counted with Vercel Web Analytics: which pages are opened, how many times the
            CV is downloaded, the referring site, country and device type. It sets no cookies and
            stores no personal data; a visit is recognised only by a hash that is discarded every day.
          </li>
          <li>
            Vercel Speed Insights records how fast pages load and respond, without identifying you.
          </li>
          <li>
            The hosting provider (Vercel) keeps standard server logs, such as IP addresses, for
            security and operation of the service.
          </li>
          <li>
            Your browser stores two small settings for this site (whether the intro has played in
            this tab, and the 3D quality that suits your device). They never leave your device.
          </li>
          <li>
            If you email me, I keep the message only to reply to you. Ask and I will delete it:{" "}
            <a href="mailto:abyossi22@gmail.com">abyossi22@gmail.com</a>.
          </li>
        </ul>
        <div className="nf-actions">
          <Link href="/" className="nf-ghost">
            Back to start
          </Link>
        </div>
      </div>
    </section>
  );
}
