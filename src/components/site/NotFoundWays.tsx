"use client";

import Link from "next/link";

/**
 * The 404's ways out. "See the work" leaves the section for the home page to scroll to once it has
 * mounted (the same hand-off Nav uses from a page without the section), since the hash alone is
 * cleared before the home page reads it.
 */
export default function NotFoundWays() {
  const toWork = () => {
    try { sessionStorage.setItem("__navTarget", "work"); } catch {}
  };
  return (
    <nav className="nf-card-ways" aria-label="Ways out">
      <Link href="/">Back to the desk</Link>
      <Link href="/#work" onClick={toWork}>See the work</Link>
    </nav>
  );
}
