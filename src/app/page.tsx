import fs from "node:fs";
import path from "node:path";
import PortfolioExperience from "@/components/portfolio/PortfolioExperience";

/**
 * The portrait is optional. Checking for it at build time means the About
 * section shows it the moment the file exists and renders nothing at all
 * until then - no placeholder frame, no broken image.
 */
const PORTRAIT_FILES = ["portrait.jpg", "portrait.png", "portrait.webp"];
/** Procedural definition exported from the Studio. */
const DEFINITION_FILES = ["avatar.avatar.json", "avatar.json"];

function findAsset(candidates: string[]): string | null {
  for (const file of candidates) {
    if (fs.existsSync(path.join(process.cwd(), "public", file))) return `/${file}`;
  }
  return null;
}

/**
 * The runtime takes the definition as a prop, so reading it here keeps the
 * build working when no avatar has been exported yet.
 */
function readAvatarDefinition(): unknown | null {
  for (const file of DEFINITION_FILES) {
    const full = path.join(process.cwd(), "public", file);
    if (!fs.existsSync(full)) continue;
    try {
      return JSON.parse(fs.readFileSync(full, "utf8"));
    } catch (error) {
      // A malformed export should fail the build loudly rather than ship a
      // silently avatar-less page.
      throw new Error(`Invalid avatar definition at public/${file}: ${(error as Error).message}`);
    }
  }
  return null;
}

export default function HomePage() {
  return (
    <PortfolioExperience
      portrait={findAsset(PORTRAIT_FILES)}
      avatarDefinition={readAvatarDefinition()}
    />
  );
}
