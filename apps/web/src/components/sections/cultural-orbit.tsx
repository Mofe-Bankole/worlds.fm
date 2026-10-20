import { GlassSurface } from "@/components/primitives/glass-surface";
import { ProvenanceBadge } from "@/components/primitives/provenance-badge";
import { SectionHeader } from "@/components/primitives/section-header";
import { ARTISTS, CONNECTIONS } from "@/content/landing";
import { PROVENANCE, PROVENANCE_KINDS } from "@/lib/provenance";
import { SectionShell } from "./section-shell";

/*
 * Static orbit. Every node is derived from ARTISTS and CONNECTIONS, so the
 * diagram can show nothing the cited content does not. Rings, inside out:
 * artists, places, genres, connections. The SVG is decorative; the lists
 * below carry the same information for assistive technology and small screens.
 */
const CENTER = 500;
const RADII = { artist: 130, place: 235, genre: 340, link: 445 } as const;
const ANGLES = [-135, -45, 45, 135];

function polar(radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  };
}

const nodes = ARTISTS.flatMap((artist, index) => {
  const angle = ANGLES[index] ?? 0;
  const artistPos = polar(RADII.artist, angle);
  const placePos = polar(RADII.place, angle);
  const genreSpread = artist.genres.length > 1 ? 9 : 0;
  const genrePositions = artist.genres.map((genre, genreIndex) => ({
    genre,
    pos: polar(
      RADII.genre,
      angle + (genreIndex - (artist.genres.length - 1) / 2) * genreSpread * 2,
    ),
  }));
  const links = CONNECTIONS.filter((c) => c.fromArtistId === artist.id).map(
    (connection, linkIndex) => ({
      connection,
      pos: polar(RADII.link, angle + (linkIndex === 0 ? 0 : 14)),
    }),
  );
  return [{ artist, artistPos, placePos, genrePositions, links }];
});

export function CulturalOrbit() {
  return (
    <SectionShell id="orbit" labelledBy="orbit-heading" className="overflow-hidden">
      <SectionHeader
        index="04"
        eyebrow="Cultural orbit"
        id="orbit-heading"
        title="Every world has layers."
        description="Artists sit at the centre. Places, genres and connections orbit outward. A solid line is verified. A dashed line is an affinity."
      />

      <div className="mt-14 grid items-start gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <svg
            viewBox="0 0 1000 1000"
            aria-hidden="true"
            focusable="false"
            className="mx-auto w-full max-w-[44rem]"
          >
            {Object.values(RADII).map((radius) => (
              <circle
                key={radius}
                cx={CENTER}
                cy={CENTER}
                r={radius}
                fill="none"
                stroke="var(--color-mint)"
                strokeOpacity="0.14"
              />
            ))}
            {nodes.map(({ artist, artistPos, placePos, genrePositions, links }) => (
              <g key={artist.id}>
                <line
                  x1={artistPos.x}
                  y1={artistPos.y}
                  x2={placePos.x}
                  y2={placePos.y}
                  stroke="var(--color-mint)"
                  strokeOpacity="0.35"
                />
                {genrePositions.map(({ genre, pos }) => (
                  <g key={genre}>
                    <line
                      x1={placePos.x}
                      y1={placePos.y}
                      x2={pos.x}
                      y2={pos.y}
                      stroke="var(--color-mint)"
                      strokeOpacity="0.35"
                    />
                    <circle cx={pos.x} cy={pos.y} r="9" fill="var(--color-forest)" />
                    <text
                      x={pos.x}
                      y={pos.y + 30}
                      textAnchor="middle"
                      className="hidden fill-text-2 text-[22px] md:block"
                    >
                      {genre}
                    </text>
                  </g>
                ))}
                {links.map(({ connection, pos }) => {
                  const dashed = PROVENANCE[connection.kind].dashArray;
                  return (
                    <g key={connection.id}>
                      <line
                        x1={placePos.x}
                        y1={placePos.y}
                        x2={pos.x}
                        y2={pos.y}
                        stroke="var(--color-electric)"
                        strokeWidth="2"
                        strokeDasharray={dashed ? "10 8" : undefined}
                      />
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="12"
                        fill={
                          connection.kind === "verified"
                            ? "var(--color-electric)"
                            : "var(--color-night)"
                        }
                        stroke="var(--color-electric)"
                        strokeWidth="2.5"
                      />
                    </g>
                  );
                })}
                <circle cx={placePos.x} cy={placePos.y} r="9" fill="var(--color-mint)" />
                <circle cx={artistPos.x} cy={artistPos.y} r="18" fill="var(--color-surface-2)" stroke="var(--color-mint)" />
                <text
                  x={artistPos.x}
                  y={artistPos.y + 5}
                  textAnchor="middle"
                  className="fill-text text-[15px] font-bold"
                >
                  {artist.name.split(" ")[0]}
                </text>
              </g>
            ))}
            <circle cx={CENTER} cy={CENTER} r="46" fill="var(--color-night)" stroke="var(--color-electric)" strokeWidth="2" />
            <text x={CENTER} y={CENTER + 6} textAnchor="middle" className="fill-text text-[20px] font-bold">
              Worlds
            </text>
          </svg>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <GlassSurface tone="strong" className="p-6 sm:p-8">
            <h3 className="type-sub text-text">How to read a link</h3>
            <ul className="mt-6 flex flex-col gap-4">
              {PROVENANCE_KINDS.map((kind) => (
                <li key={kind} className="flex flex-col gap-2">
                  <ProvenanceBadge kind={kind} size="sm" />
                  <p className="type-small text-text-2">
                    {PROVENANCE[kind].meaning}
                  </p>
                </li>
              ))}
            </ul>
          </GlassSurface>
        </div>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2">
        {nodes.map(({ artist, links }) => (
          <section
            key={artist.id}
            aria-label={`${artist.name} orbit`}
            className="rounded-panel border border-line bg-surface-1 p-6"
          >
            <h3 className="type-sub text-text">{artist.name}</h3>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
              <dt className="type-eyebrow text-text-3">Place</dt>
              <dd className="text-text-2">{artist.location.label}</dd>
              <dt className="type-eyebrow text-text-3">Genre</dt>
              <dd className="text-text-2">{artist.genres.join(", ")}</dd>
              {links.map(({ connection }) => (
                <div key={connection.id} className="contents">
                  <dt className="type-eyebrow text-text-3">
                    {connection.kind === "verified" ? "Verified" : "Affinity"}
                  </dt>
                  <dd className="text-text-2">
                    {connection.target.name}
                    {connection.kind === "affinity" ? " (Qloo fixture)" : ""}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="type-small mt-6 text-text-3">
        Demo data. Places and genres restate cited facts. Affinities are
        hand-written fixtures, not Qloo results.
      </p>
    </SectionShell>
  );
}
