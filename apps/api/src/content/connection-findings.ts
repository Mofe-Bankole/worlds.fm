import {
  CONNECTION_FINDINGS_VERSION,
  connectionFindingsArtifactSchema,
  type ConnectionFindingsArtifact,
  type ConnectionFinding,
} from "@worlds/shared";

/**
 * Reviewed connection findings (AGENTS.md §12).
 *
 * This is the precomputed half of the connection agent: research done ahead of
 * time, stored as a versioned artifact so it can be read and reviewed in a diff
 * before anyone sees it. The graph builder reads it to produce `documented`
 * edges; nothing here is generated at request time.
 *
 * ## How to read a finding
 *
 * - `subject` and `target` are **graph node names**, so a finding can be matched
 *   against a Qloo node. The authoritative entity lives in `citations`, which
 *   carry the URL. A node name and a source's own title may differ (Qloo says
 *   "Damian Marley"; MusicBrainz says `Damian "Jr. Gong" Marley`), and the
 *   citation is what settles it.
 * - `statement` says only what the cited source states. Every statement below is
 *   phrased as "MusicBrainz records …" for exactly that reason: it reports a
 *   record, and claims nothing about biography, influence or causation
 *   (AGENTS.md §5).
 * - A `declined` finding is a real result. It records that the pair was
 *   researched and nothing citable was found, which is why it carries a
 *   `method.query` and no statement.
 *
 * ## Verification status
 *
 * Each finding was verified against live MusicBrainz output on 2026-10-24:
 * `?inc=artist-rels` on the cited entities, read directly. `reviewedBy` names
 * the verifier.
 *
 * **This is machine verification, not human editorial review.** The same
 * caveat already applies to the featured-world facts. A human must read these
 * against their sources before the claims are treated as editorially signed
 * off, which is why `reviewedBy` is left explicit rather than aspirational.
 */

const MUSICBRAINZ_LICENSE = "CC0 1.0";
const mbArtist = (id: string) => `https://musicbrainz.org/artist/${id}`;

/** MusicBrainz entity IDs, kept separate from the graph's own node names. */
const MB = {
  bobMarley: "ed2ac1e9-d51d-4eff-a2c2-85e81abd6360",
  tameImpala: "63aa26c3-d59b-4da4-84ac-716b54f1ef4d",
  kevinParker: "b0ad6d5e-44f1-41a3-a452-1c378d350cb8",
  pond: "69ac44f7-c80d-47b4-9bc8-fcc758d209e6",
} as const;

const mbCitation = (id: string, label: string) => ({
  sourceLabel: label,
  sourceUrl: mbArtist(id),
  license: MUSICBRAINZ_LICENSE,
});

const reviewed = "2026-10-24";
const reviewedBy = "droid";

const findings: ConnectionFinding[] = [
  /* ------------------------------ Bob Marley ------------------------------ */
  {
    subject: { name: "Bob Marley", category: "artist" },
    target: { name: "Bob Marley & The Wailers", category: "artist" },
    outcome: "documented",
    statement:
      "MusicBrainz records Bob Marley as an original member of Bob Marley & The Wailers, on lead vocals from December 1970.",
    // Read from Bob Marley's own MusicBrainz page, which is where the
    // membership relation is stated. Only sources actually consulted are cited.
    citations: [mbCitation(MB.bobMarley, "MusicBrainz — Bob Marley")],
    method: {
      consulted: ["MusicBrainz"],
      query: "artist-to-artist membership between Bob Marley and Bob Marley & The Wailers",
    },
    reviewedAt: reviewed,
    reviewedBy,
  },
  {
    subject: { name: "Bob Marley", category: "artist" },
    target: { name: "Ziggy Marley", category: "artist" },
    outcome: "documented",
    statement: "MusicBrainz records Ziggy Marley as a child of Bob Marley, born 17 October 1968.",
    citations: [mbCitation(MB.bobMarley, "MusicBrainz — Bob Marley")],
    method: {
      consulted: ["MusicBrainz"],
      query: "artist-to-artist family relationship between Bob Marley and Ziggy Marley",
    },
    reviewedAt: reviewed,
    reviewedBy,
  },
  {
    subject: { name: "Bob Marley", category: "artist" },
    target: { name: "Stephen Marley", category: "artist" },
    outcome: "documented",
    statement: "MusicBrainz records Stephen Marley as a child of Bob Marley, born 20 April 1972.",
    citations: [mbCitation(MB.bobMarley, "MusicBrainz — Bob Marley")],
    method: {
      consulted: ["MusicBrainz"],
      query: "artist-to-artist family relationship between Bob Marley and Stephen Marley",
    },
    reviewedAt: reviewed,
    reviewedBy,
  },
  {
    subject: { name: "Bob Marley", category: "artist" },
    target: { name: "Damian Marley", category: "artist" },
    outcome: "documented",
    statement: "MusicBrainz records Damian Marley as a child of Bob Marley, born 21 July 1978.",
    citations: [mbCitation(MB.bobMarley, "MusicBrainz — Bob Marley")],
    method: {
      consulted: ["MusicBrainz"],
      query: "artist-to-artist family relationship between Bob Marley and Damian Marley",
    },
    reviewedAt: reviewed,
    reviewedBy,
  },

  /* ------------------------------ Tame Impala ----------------------------- */
  {
    subject: { name: "Tame Impala", category: "artist" },
    target: { name: "Pond", category: "artist" },
    outcome: "documented",
    statement:
      "MusicBrainz records Kevin Parker as the person behind Tame Impala, and as a member of Pond on drums since 2009.",
    citations: [
      mbCitation(MB.kevinParker, "MusicBrainz — Kevin Parker"),
      mbCitation(MB.tameImpala, "MusicBrainz — Tame Impala"),
      mbCitation(MB.pond, "MusicBrainz — Pond"),
    ],
    method: {
      consulted: ["MusicBrainz"],
      query: "shared membership between Tame Impala and Pond",
    },
    reviewedAt: reviewed,
    reviewedBy,
  },

  /* ------------------------------- Declines ------------------------------- */
  // Recorded so a reader can tell "we looked and there is nothing" from "we
  // never looked". Both are correct answers; only one is a finding.
  {
    subject: { name: "Tame Impala", category: "artist" },
    target: { name: "GoPro", category: "brand" },
    outcome: "declined",
    statement: null,
    citations: [],
    method: {
      consulted: ["MusicBrainz"],
      query: "any documented relationship between the artist Tame Impala and the brand GoPro",
    },
    reviewedAt: reviewed,
    reviewedBy,
  },
  {
    subject: { name: "Tame Impala", category: "artist" },
    target: { name: "Melbourne", category: "destination" },
    outcome: "declined",
    statement: null,
    citations: [],
    method: {
      consulted: ["MusicBrainz"],
      query:
        "a documented origin, residence or venue link between Tame Impala and Melbourne; MusicBrainz records the artist's origin at city level as Perth, not Melbourne",
    },
    reviewedAt: reviewed,
    reviewedBy,
  },
];

/**
 * Validated at import, so a malformed or uncited finding fails the build and the
 * test suite rather than reaching a reader. `documented` without a citation
 * cannot parse (see `connectionFindingSchema`).
 */
export const CONNECTION_FINDINGS: ConnectionFindingsArtifact = connectionFindingsArtifactSchema.parse({
  version: CONNECTION_FINDINGS_VERSION,
  producedBy:
    "Connection agent, precomputed. Statements verified against live MusicBrainz artist relationships on 2026-10-24; pending human editorial review.",
  findings,
});
