import Link from "next/link";

export const metadata = {
  title: "Not found - Yossi Abutbul",
  description: "This page doesn't exist.",
};

export default function NotFound() {
  return (
    <section className="nf-page">
      <div className="container nf-inner">
        <span className="mono nf-stamp">Error 404</span>
        <h1 className="nf-code">404</h1>
        <p className="nf-headline">No page at this address.</p>
        <p className="nf-sub">
          The URL resolved, but nothing was ever published here.
        </p>
        <div className="nf-actions">
          <Link href="/" className="nf-primary">
            Back to start
          </Link>
          <Link href="/#work" className="nf-ghost">
            Selected work
          </Link>
        </div>
      </div>
    </section>
  );
}
