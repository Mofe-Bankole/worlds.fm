import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Release } from "@worlds/shared";
import { PlayerPlayButton, PlayerProvider } from "../src/components/music/player-context";
import { ReleaseDetail } from "../src/components/music/release-detail";
import { ALBUM } from "./spotify-fixtures";

const release: Release = {
  id: "aaaaaaaa-0000-4000-8000-000000000001", title: "Fixture album", kind: "album", secondaryTypes: [],
  firstReleaseDate: null, year: null, trackCount: null, cover: null, spotify: null,
  musicbrainzUrl: "https://musicbrainz.org/release-group/aaaaaaaa-0000-4000-8000-000000000001",
};
const renderRelease = (value: Release) => renderToStaticMarkup(createElement(PlayerProvider, null,
  createElement(ReleaseDetail, { release: value, artistName: "Fixture artist", onClose: () => {}, onSearchName: () => {} }),
));

describe("player control rendering without browser requests", () => {
  it("preserves MusicBrainz and shows no play control for an unmatched release", () => {
    const html = renderRelease(release);
    expect(html).toContain(release.musicbrainzUrl);
    expect(html).not.toContain("Play album");
    expect(html).not.toContain("in the player");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("iframe-api/v1");
  });

  it("offers a labelled native play button and retains the external link for matched releases", () => {
    const html = renderRelease({ ...release, spotify: { id: ALBUM.id, url: `https://open.spotify.com/album/${ALBUM.id}` } });
    expect(html).toContain('aria-label="Play Fixture album in the player"');
    expect(html).toContain("Open in Spotify");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("iframe-api/v1");
  });

  it("refuses an invalid ID even if a caller tries to create a play control", () => {
    const html = renderToStaticMarkup(createElement(PlayerProvider, null,
      createElement(PlayerPlayButton, { entity: { ...ALBUM, id: "" } }, "Play"),
    ));
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<iframe");
  });
});
