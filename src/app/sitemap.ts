import type { MetadataRoute } from "next";
import { getAllSlugs } from "@content/projects";
import { SITE_URL } from "@/lib/site";

// Built once into out/sitemap.xml (static export).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    ...getAllSlugs().map((slug) => ({
      url: `${SITE_URL}/projects/${slug}/`,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  ];
}
