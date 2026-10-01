import { FEATURED_PROJECTS, OTHER_PROJECTS } from "@content/projects";
import LaunchStage from "@/components/launch/LaunchStage";
import LaunchIntro from "@/components/launch/LaunchIntro";
import LaunchShips from "@/components/launch/LaunchShips";
import LaunchReel from "@/components/launch/LaunchReel";
import LaunchThermal from "@/components/launch/LaunchThermal";
import LaunchPress from "@/components/launch/LaunchPress";
import LaunchEditorial from "@/components/launch/LaunchEditorial";
import LaunchContact from "@/components/launch/LaunchContact";
import LaunchToast from "@/components/launch/LaunchToast";
import LaunchLoader from "@/components/launch/LaunchLoader";
import LaunchHeroScroll from "@/components/launch/LaunchHeroScroll";

/**
 * The home page is one launch: the desk, the spotlight, the reel, the thermal test, the button,
 * the cream release history and the contact panels. The scene behind it is driven by these
 * sections' ids (see launch/scene.ts).
 */
export default function Home() {
  return (
    <div style={{ position: "relative" }}>
      {/* Without scripting nothing would ever lift the sheet, so it must not show at all. */}
      <noscript><style>{"[data-launch-loader]{display:none!important}header{opacity:1!important;visibility:visible!important}"}</style></noscript>
      <LaunchLoader />
      <LaunchStage />
      <LaunchIntro />
      <LaunchHeroScroll />
      <LaunchShips />
      <LaunchReel projects={FEATURED_PROJECTS} />
      <LaunchThermal />
      <LaunchPress />
      <LaunchEditorial featured={FEATURED_PROJECTS} other={OTHER_PROJECTS} />
      <LaunchContact />
      <LaunchToast />
    </div>
  );
}
