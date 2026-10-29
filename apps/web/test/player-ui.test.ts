import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RecordingStoryResponse, Release } from "@worlds/shared";
import { PlayerPlayButton, PlayerProvider } from "../src/components/music/player-context";
import { ReleaseDetail } from "../src/components/music/release-detail";
import { SongView } from "../src/components/music/song-view";
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
  it("offers a track player on a song page with a MusicBrainz-linked Spotify ID, even without an album listing", () => {
    const story = {
      recording: {
        mbid: release.id, title: "Fixture track", artistCredit: "Fixture artist",
        durationMs: null, isrcs: [], musicbrainzUrl: `https://musicbrainz.org/recording/${release.id}`,
        spotify: { id: "B".repeat(22), url: `https://open.spotify.com/track/${"B".repeat(22)}` },
      },
      work: null, facts: [], credits: [], samples: [], sampledBy: [], otherVersions: [],
      notice: "Fixture.", retrievedAt: "2026-10-24T00:00:00.000Z",
    } satisfies RecordingStoryResponse;
    const renderSong = (value: RecordingStoryResponse) => renderToStaticMarkup(createElement(PlayerProvider, null,
      createElement(SongView, { mbid: release.id, story: value }),
    ));
    const html = renderSong(story);
    expect(html).toContain('aria-label="Play Fixture track in the player"');
    expect(html).toContain("Open in Spotify");
    expect(html).not.toContain("<iframe");
    expect(renderSong({ ...story, recording: { ...story.recording, spotify: null } })).not.toContain("in the player");
  });

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
