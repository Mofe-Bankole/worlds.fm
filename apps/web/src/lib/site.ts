import { headers } from "next/headers";

/**
 * Absolute site URL for server-rendered metadata: canonical links and the Open
 * Graph image URL. Server-only.
 *
 * The browser does not use this: share links are built from
 * `window.location.origin` (see `resolveShareOrigin` in lib/share.ts), which is
 * always correct for the deployment actually being viewed.
 */

function trim(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Build-time origin, for routes that cannot read request headers (sitemap, robots). */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return trim(configured);

  // Vercel provides these during builds. The production domain is preferred
  // over the per-deployment URL, so canonical tags never point at a preview.
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }

  return "http://localhost:3000";
}

/**
 * Origin for a canonical tag on a server-rendered page.
 *
 * Precedence: an explicitly configured canonical origin, then the Vercel
 * production domain, then the host this request actually arrived on. The last
 * fallback keeps a canonical URL honest on any other host, instead of claiming
 * localhost.
 */
export async function siteUrlFromRequest(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return trim(configured);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${trim(vercel.replace(/^https?:\/\//, ""))}`;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (host) {
    const forwardedProto = requestHeaders.get("x-forwarded-proto");
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
    return `${forwardedProto ?? (local ? "http" : "https")}://${host}`;
  }

  return siteUrl();
}
