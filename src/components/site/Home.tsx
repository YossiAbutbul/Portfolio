import { FEATURED_PROJECTS, OTHER_PROJECTS } from "@content/projects";
import LaunchStage from "@/components/launch/LaunchStage";
import LaunchIntro from "@/components/launch/LaunchIntro";
import LaunchShips from "@/components/launch/LaunchShips";
import LaunchBrowser from "@/components/launch/LaunchBrowser";
import LaunchNotebook from "@/components/launch/LaunchNotebook";
import LaunchEditorial from "@/components/launch/LaunchEditorial";
import LaunchContact from "@/components/launch/LaunchContact";
import LaunchToast from "@/components/launch/LaunchToast";
import LaunchLoader from "@/components/launch/LaunchLoader";
import LaunchHeroScroll from "@/components/launch/LaunchHeroScroll";

/**
 * The home page is one launch: the desk, the spotlight, the projects, the notebook of more work on the desk,
 * the cream release history and the contact panels. The scene behind it is driven by these
 * sections' ids (see launch/scene.ts).
 */
export default function Home() {
  return (
    <div style={{ position: "relative" }}>
      {/* Without scripting nothing would ever lift the sheet, so it must not show at all. */}
      <noscript><style>{"[data-launch-loader]{display:none!important}header{opacity:1!important;visibility:visible!important}#hero-name,[data-card],[data-cue]{animation:none!important}"}</style></noscript>
      <LaunchLoader />
      <LaunchStage />
      <LaunchIntro />
      <LaunchHeroScroll />
      <LaunchShips />
      <LaunchBrowser projects={FEATURED_PROJECTS} />
      <LaunchNotebook projects={OTHER_PROJECTS} />
      <LaunchEditorial />
      <LaunchContact />
      <LaunchToast />
    </div>
  );
}
