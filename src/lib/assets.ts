import fs from "node:fs";
import path from "node:path";

/**
 * The portrait is optional. Checking at build time means the About section
 * shows it the moment the file exists and renders nothing at all until then,
 * with no placeholder frame and no broken image.
 */
const PORTRAIT_FILES = ["portrait.jpg", "portrait.png", "portrait.webp", "portrait.avif"];

export function findPortrait(): string | null {
  for (const file of PORTRAIT_FILES) {
    if (fs.existsSync(path.join(process.cwd(), "public", file))) return `/${file}`;
  }
  return null;
}
