import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { ogCardFontSize } from "@/lib/share";

/**
 * The 1200×630 preview card shared by every Worlds.fm destination.
 *
 * It is a presentation asset, not a domain API: it draws only what it is given
 * and calls no provider. Callers pass text derived from a URL parameter, so the
 * card can never verify anything and must not claim anything. Verification and
 * labelling happen on the page the link opens (AGENTS.md §5).
 *
 * Colors come from `BRAND`, which mirrors `styles/tokens.css`. `next/og` renders
 * outside the document, so CSS variables are not available here.
 */

/** Card dimensions. Fixed so every card matches what the metadata advertises. */
export const CARD_SIZE = { width: 1200, height: 630 };

export interface ShareCardOptions {
  /** Small green label above the title. */
  eyebrow: string;
  /** The destination's name, drawn as large as it fits. */
  label: string;
  /** One line under the title. */
  subline: string;
  /** Bottom-left note. */
  footerNote: string;
}

export function shareCard({ eyebrow, label, subline, footerNote }: ShareCardOptions): ImageResponse {
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
          background: BRAND.night,
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: BRAND.electric }} />
          <div style={{ color: BRAND.text, fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>
            Worlds.fm
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              color: BRAND.vibrant,
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
              color: BRAND.text,
              fontSize,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -3,
              display: "flex",
            }}
          >
            {label}
          </div>
          <div style={{ color: BRAND.text2, fontSize: 30, display: "flex" }}>{subline}</div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: `1px solid ${BRAND.forest}`,
            paddingTop: 26,
            color: BRAND.text3,
            fontSize: 24,
          }}
        >
          <div style={{ display: "flex" }}>{footerNote}</div>
          <div style={{ display: "flex", color: BRAND.mint }}>worlds.fm</div>
        </div>
      </div>
    ),
    {
      ...CARD_SIZE,
      headers: {
        // A card is deterministic for given text, so it caches well.
        "cache-control": "public, max-age=3600, s-maxage=86400",
      },
    },
  );
}
