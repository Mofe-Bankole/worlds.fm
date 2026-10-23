import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * The design-system page is a development reference, so it stays out of the
 * index. A shared World is public by design and is not restricted here.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/design" }],
    sitemap: `${base}/sitemap.xml`,
  };
}
