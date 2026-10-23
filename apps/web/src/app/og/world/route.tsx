import { ImageResponse } from "next/og";
import { ogCardFontSize, ogCardName } from "@/lib/share";

/**
 * Open Graph card for a shared World: `/og/world?name=<artist>`.
 *
 * A route handler rather than the `opengraph-image` convention, for two
 * reasons: the World lives at `/explore?q=<artist>`, so the name is a query
 * parameter and there is no path segment to key the convention on; and the
 * convention would need a duplicate `/world/[name]` route purely to satisfy the
 * file layout, since the canonical URL is the query form.
 *
 * This is a presentation asset, not a domain API: it reads the name from the
 * URL, calls no provider, and touches no database. It is served from apps/web
 * like any other image, and the API contract is untouched.
 *
 * The name is drawn as given, shortened only when it would overflow. It is not
 * resolved, corrected or verified here; the page it links to does that and
 * labels what it finds.
 */

/** Card dimensions. Not exported: a route handler may only export HTTP verbs. */
const size = { width: 1200, height: 630 };

const NAME_MAX_LENGTH = 80;

export function GET(request: Request): ImageResponse {
  const raw = new URL(request.url).searchParams.get("name") ?? "";
  const name = ogCardName(raw, NAME_MAX_LENGTH);
  // Without a name this doubles as the site card, which the root layout uses as
  // the default preview for pages that are not about one artist.
  const label = name || "Every sound has a world";
  const eyebrow = name ? "Cultural world" : "Music × culture × place";
  const fontSize = ogCardFontSize(label.length);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#08120B",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: "#00CD37" }} />
          <div style={{ color: "#EEF6EF", fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>
            Worlds.fm
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              color: "#46D35D",
              fontSize: 26,
              letterSpacing: 4,
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              color: "#EEF6EF",
              fontSize,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -3,
              display: "flex",
            }}
          >
            {label}
          </div>
          <div style={{ color: "#A3B5A8", fontSize: 30, display: "flex" }}>
            The artists, places and brands connected to them.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #2A6E4C",
            paddingTop: 26,
            color: "#8AA090",
            fontSize: 24,
          }}
        >
          <div style={{ display: "flex" }}>Every link shows what it is based on.</div>
          <div style={{ display: "flex", color: "#CBF2CD" }}>worlds.fm</div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        // The card is deterministic for a given name, so it caches well.
        "cache-control": "public, max-age=3600, s-maxage=86400",
      },
    },
  );
}
