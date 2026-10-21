import { describe, expect, it } from "vitest";
import {
  albumMediaQuerySchema,
  apiErrorResponseSchema,
  artistMediaQuerySchema,
  artistMediaResponseSchema,
  mediaImageCandidateSchema
} from "@worlds/shared";

const validCandidate = {
  url: "https://r2.theaudiodb.com/images/media/artist/thumb/fela.jpg",
  provider: "theaudiodb",
  sourcePageUrl: "https://www.theaudiodb.com/artist/121444",
  artistName: "Fela Kuti",
  albumTitle: null,
  artistMbid: "6514cffa-fbe0-4965-ad88-e998ead8a82a",
  releaseMbid: null,
  releaseGroupMbid: null,
  imageType: "artist",
  width: null,
  height: null,
  attribution: "TheAudioDB community (theaudiodb.com)",
  copyrightHolder: null,
  licenseUrl: null,
  rightsStatus: "unverified"
} as const;

describe("shared media contracts", () => {
  it("accepts a well-formed image candidate", () => {
    expect(mediaImageCandidateSchema.safeParse(validCandidate).success).toBe(true);
  });

  it("rejects non-URL image values", () => {
    expect(
      mediaImageCandidateSchema.safeParse({ ...validCandidate, url: "not-a-url" }).success
    ).toBe(false);
  });

  it("rejects unknown rights statuses (only cleared/unverified/restricted exist)", () => {
    expect(
      mediaImageCandidateSchema.safeParse({ ...validCandidate, rightsStatus: "ish" }).success
    ).toBe(false);
  });

  it("rejects malformed MusicBrainz identifiers", () => {
    expect(
      mediaImageCandidateSchema.safeParse({ ...validCandidate, artistMbid: "abc" }).success
    ).toBe(false);
  });

  it("enforces query limits and rejects unexpected keys", () => {
    expect(artistMediaQuerySchema.safeParse({ name: "x" }).success).toBe(false); // too short
    expect(artistMediaQuerySchema.safeParse({ name: "a".repeat(121) }).success).toBe(false);
    expect(
      artistMediaQuerySchema.safeParse({ name: "Fela Kuti", admin: "true" }).success
    ).toBe(false);
    expect(
      albumMediaQuerySchema.safeParse({ artist: "Rihanna", title: "ANTI" }).success
    ).toBe(true);
    expect(albumMediaQuerySchema.safeParse({ artist: "Rihanna" }).success).toBe(false);
  });

  it("parses the canonical error envelope", () => {
    expect(
      apiErrorResponseSchema.safeParse({
        error: { code: "invalid_query", message: "name required", requestId: "req-1" }
      }).success
    ).toBe(true);
  });

  it("parses a full artist response shape", () => {
    const response = {
      subjectType: "artist",
      query: { name: "Fela Kuti", mbid: null },
      status: "resolved",
      artist: {
        name: "Fela Kuti",
        mbid: "6514cffa-fbe0-4965-ad88-e998ead8a82a",
        theAudioDbId: "121444"
      },
      matches: [],
      candidates: [validCandidate],
      approvedImages: [],
      fallback: {
        reason: "rights_unverified",
        message: "placeholder required"
      },
      providers: [{ provider: "theaudiodb", status: "ok" }],
      cached: false,
      generatedAt: "2026-10-20T00:00:00.000Z"
    };
    expect(artistMediaResponseSchema.safeParse(response).success).toBe(true);
  });
});
