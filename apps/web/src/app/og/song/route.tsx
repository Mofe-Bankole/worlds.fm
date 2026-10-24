import { shareCard } from "@/components/og/share-card";
import { ogCardName } from "@/lib/share";

/**
 * Open Graph card for a shared song: `/og/song?title=<title>&artist=<artist>`.
 *
 * Like the World card this is a presentation asset: it draws the text it is
 * given and calls no provider, so it cannot verify the title or the artist and
 * states no fact about either. The page it links to reads the MusicBrainz
 * recording and labels every credit with its source.
 *
 * Both parameters are optional. A link with neither still produces the site
 * card, so a malformed URL never renders a broken preview.
 */

const TITLE_MAX_LENGTH = 70;
const ARTIST_MAX_LENGTH = 44;

export function GET(request: Request): Response {
  const params = new URL(request.url).searchParams;
  const title = ogCardName(params.get("title") ?? "", TITLE_MAX_LENGTH);
  const artist = ogCardName(params.get("artist") ?? "", ARTIST_MAX_LENGTH);

  if (!title) {
    return shareCard({
      eyebrow: "Music × culture × place",
      label: "Every sound has a world",
      subline: "The artists, places and brands connected to them.",
      footerNote: "Every link shows what it is based on.",
    });
  }

  return shareCard({
    eyebrow: "Song",
    label: title,
    subline: artist ? `${artist} · credits, samples and other versions` : "Credits, samples and other versions",
    footerNote: "Every fact cites its source.",
  });
}
