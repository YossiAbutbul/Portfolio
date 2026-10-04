import { pageview } from "@vercel/analytics";

/** The CV PDF in `public/`. */
export const CV_PDF = "/Yossi Abutbul - CV 2026.pdf";

/** Counts a CV download as a page view of `/cv` in Web Analytics (custom events need a paid plan).
 *  Nothing navigates: the link still downloads the PDF in place. */
export function countCvDownload() {
  pageview({ route: "/cv", path: "/cv" });
}
