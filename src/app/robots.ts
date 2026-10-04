import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Built once into out/robots.txt (static export).
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
