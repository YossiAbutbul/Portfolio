import Link from "next/link";
import LaunchLoader from "@/components/launch/LaunchLoader";
import LaunchStage from "@/components/launch/LaunchStage";

export const metadata = {
  title: "Not found - Yossi Abutbul",
  description: "This page doesn't exist.",
};

// The 404: More work's corner of the desk, live, with a "404" standing on the mat (the scene's "wall"
// pose), opened by the loading sheet with a blueprint of the 404 in place of the device. The way out
// is a card in the hero card's warm glass.
export default function NotFound() {
  return (
    <section className="nf-page" aria-labelledby="nf-title">
      <LaunchLoader mark="404" />
      <LaunchStage pose="wall" />
      <div className="nf-card">
        <h1 id="nf-title" className="nf-card-head">
          <span className="sr-only">404: </span>This page isn&rsquo;t on the desk.
        </h1>
        <p className="nf-card-body">Everything on it still works. Press the 404.</p>
        <nav className="nf-card-ways" aria-label="Ways out">
          <Link href="/">Back to the desk</Link>
          <Link href="/#work">See the work</Link>
        </nav>
      </div>
    </section>
  );
}
