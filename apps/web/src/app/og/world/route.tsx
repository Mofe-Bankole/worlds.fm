import { shareCard } from "@/components/og/share-card";
import { ogCardName } from "@/lib/share";

/**
 * Open Graph card for a shared World: `/og/world?name=<artist>`.
 *
 * A route handler rather than the `opengraph-image` convention, for two
 * reasons: the World lives at `/explore?q=<artist>`, so the name is a query
 * parameter and there is no path segment to key the convention on; and the
 * convention would need a duplicate `/world/[name]` route purely to satisfy the
 * file layout, since the canonical URL is the query form.
 *
 * The name is drawn as given, shortened only when it would overflow. It is not
 * resolved, corrected or verified here; the page it links to does that and
 * labels what it finds.
 */

const NAME_MAX_LENGTH = 80;

export function GET(request: Request): Response {
  const raw = new URL(request.url).searchParams.get("name") ?? "";
  const name = ogCardName(raw, NAME_MAX_LENGTH);
  // Without a name this doubles as the site card, which the root layout uses as
  // the default preview for pages that are not about one artist.
  const label = name || "Every sound has a world";

  return shareCard({
    eyebrow: name ? "Cultural world" : "Music × culture × place",
    label,
    subline: "The artists, places and brands connected to them.",
    footerNote: "Every link shows what it is based on.",
  });
}
