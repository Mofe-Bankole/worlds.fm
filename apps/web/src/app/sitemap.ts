import type { MetadataRoute } from "next";
import { FEATURED_WORLDS } from "@/content/featured-worlds";
import { siteUrl } from "@/lib/site";
import { worldPath } from "@/lib/share";

/**
 * Only pages worth crawling are listed. Every featured World is a real public
 * page. Arbitrary `/explore?q=` URLs are deliberately left out: they are
 * generated on demand and have no unique content of their own until a visitor
 * arrives, so indexing them all would add nothing.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date();

  return [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    ...FEATURED_WORLDS.map((world) => ({
      url: `${base}${worldPath(world.name)}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
