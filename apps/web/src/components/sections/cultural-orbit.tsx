import { ContourField } from "@/components/primitives/contour-field";
import { GlassSurface } from "@/components/primitives/glass-surface";
import { DemoBadge, ProvenanceBadge } from "@/components/primitives/provenance-badge";
import { SectionHeader } from "@/components/primitives/section-header";
import { ARTISTS, CONNECTIONS } from "@/content/landing";
import { PROVENANCE, PROVENANCE_KINDS } from "@/lib/provenance";
import { SectionShell } from "./section-shell";

/*
 * Static orbit, the signature view of the product. Every node is derived from
 * ARTISTS and CONNECTIONS, so the diagram can show nothing the cited content
 * does not. Rings, inside out: artists, places, genres, connections. The SVG
 * is decorative; the lists below carry the same information for assistive
 * technology and small screens.
 */
const CENTER = 500;
const RADII = { artist: 130, place: 235, genre: 340, link: 445 } as const;
const RING_CAPTIONS = [
  ["Artists", RADII.artist],
  ["Places", RADII.place],
  ["Genres", RADII.genre],
  ["Connections", RADII.link],
] as const;
const ANGLES = [-135, -45, 45, 135];
const LABEL_GAP = 22;

function polar(radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  };
}

/** Side of the diagram a node sits on decides which way its label runs. */
function labelProps(x: number) {
  const left = x < CENTER;
  return {
    x: x + (left ? -LABEL_GAP : LABEL_GAP),
    textAnchor: left ? ("end" as const) : ("start" as const),
  };
}

const nodes = ARTISTS.map((artist, index) => {
  const angle = ANGLES[index] ?? 0;
  const spread = artist.genres.length > 1 ? 9 : 0;
  return {
    artist,
    artistPos: polar(RADII.artist, angle),
    placePos: polar(RADII.place, angle),
    placeName: artist.location.label.split(",")[0] ?? artist.location.label,
    genrePositions: artist.genres.map((genre, i) => ({
      genre,
      pos: polar(
        RADII.genre,
        angle + (i - (artist.genres.length - 1) / 2) * spread * 2,
      ),
    })),
    links: CONNECTIONS.filter((c) => c.fromArtistId === artist.id).map(
      (connection, i) => ({
        connection,
        pos: polar(RADII.link, angle + (i === 0 ? 0 : 13)),
      }),
    ),
  };
});

const LABEL = "hidden md:block [paint-order:stroke] stroke-night [stroke-width:7px]";

export function CulturalOrbit() {
  return (
    <SectionShell id="orbit" labelledBy="orbit-heading" className="overflow-hidden">
      <SectionHeader
        index="04"
        eyebrow="Cultural orbit"
        id="orbit-heading"
        size="lg"
        align="center"
        title={
          <>
            Every world <span className="type-accent text-mint">has layers.</span>
          </>
        }
        description="The graph is the heart of Worlds.fm. Artists sit at the centre, with places, genres and connections orbiting outward. A solid line is verified. A dashed line is an affinity."
      />

      <div className="relative mt-14 overflow-hidden rounded-[2.5rem] border border-line-strong bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,color-mix(in_oklab,var(--color-forest)_45%,var(--color-night)),var(--color-night)_75%)] shadow-lift">
        <ContourField
          rings={14}
          seed={11}
          wobble={0.04}
          className="pointer-events-none absolute left-1/2 top-1/2 size-[140%] max-w-none -translate-x-1/2 -translate-y-1/2 text-mint/10"
        />
        <div className="relative aspect-square md:aspect-[1500/1060]">
          <svg
            viewBox="-250 -30 1500 1060"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            focusable="false"
            className="absolute inset-0 size-full"
          >
            {RING_CAPTIONS.map(([caption, radius]) => (
              <g key={caption}>
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={radius}
                  fill="none"
                  stroke="var(--color-mint)"
                  strokeOpacity="0.22"
                />
                <text
                  x={CENTER}
                  y={CENTER - radius + 6}
                  textAnchor="middle"
                  className={`${LABEL} fill-text-3 font-mono text-[15px] uppercase tracking-[0.18em]`}
                >
                  {caption}
                </text>
              </g>
            ))}

            {nodes.map(({ artist, artistPos, placePos, placeName, genrePositions, links }) => (
              <g key={artist.id}>
                <line x1={artistPos.x} y1={artistPos.y} x2={placePos.x} y2={placePos.y} stroke="var(--color-mint)" strokeOpacity="0.5" />
                {genrePositions.map(({ genre, pos }) => {
                  const label = labelProps(pos.x);
                  return (
                    <g key={genre}>
                      <line x1={placePos.x} y1={placePos.y} x2={pos.x} y2={pos.y} stroke="var(--color-mint)" strokeOpacity="0.5" />
                      <circle cx={pos.x} cy={pos.y} r="11" fill="var(--color-forest)" stroke="var(--color-mint)" strokeOpacity="0.7" />
                      <text {...label} y={pos.y + 8} className={`${LABEL} fill-text-2 text-[24px]`}>
                        {genre}
                      </text>
                    </g>
                  );
                })}
                {links.map(({ connection, pos }) => {
                  const dashed = PROVENANCE[connection.kind].dashArray;
                  const label = labelProps(pos.x);
                  return (
                    <g key={connection.id}>
                      <line
                        x1={placePos.x}
                        y1={placePos.y}
                        x2={pos.x}
                        y2={pos.y}
                        stroke="var(--color-electric)"
                        strokeWidth="2.5"
                        strokeDasharray={dashed ? "10 8" : undefined}
                      />
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="15"
                        fill={connection.kind === "verified" ? "var(--color-electric)" : "var(--color-night)"}
                        stroke="var(--color-electric)"
                        strokeWidth="3"
                      />
                      <text {...label} y={pos.y + 8} className={`${LABEL} fill-text text-[26px] font-semibold`}>
                        {connection.target.name}
                      </text>
                    </g>
                  );
                })}
                <circle cx={placePos.x} cy={placePos.y} r="11" fill="var(--color-mint)" />
                <text
                  x={placePos.x}
                  y={placePos.y + (placePos.y < CENTER ? 40 : -22)}
                  textAnchor="middle"
                  className={`${LABEL} fill-mint text-[22px] font-semibold`}
                >
                  {placeName}
                </text>
                <circle cx={artistPos.x} cy={artistPos.y} r="40" fill="var(--color-surface-2)" stroke="var(--color-mint)" strokeWidth="1.5" />
                <text x={artistPos.x} y={artistPos.y + 6} textAnchor="middle" className="fill-text text-[17px] font-bold">
                  {artist.name.split(" ")[0]}
                </text>
              </g>
            ))}

            <circle cx={CENTER} cy={CENTER} r="62" fill="var(--color-night)" stroke="var(--color-electric)" strokeWidth="2.5" />
            <text x={CENTER} y={CENTER + 8} textAnchor="middle" className="fill-text text-[26px] font-extrabold">
              Worlds
            </text>
          </svg>
        </div>

        <GlassSurface
          tone="strong"
          radius="panel"
          className="relative mx-4 mb-4 p-6 sm:mx-6 sm:mb-6"
        >
          <h3 className="type-eyebrow text-text-2">How to read a link</h3>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PROVENANCE_KINDS.map((kind) => (
              <li key={kind} className="flex flex-col gap-2">
                <ProvenanceBadge kind={kind} size="sm" />
                <p className="text-xs leading-snug text-text-2">
                  {PROVENANCE[kind].meaning}
                </p>
              </li>
            ))}
          </ul>
        </GlassSurface>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {nodes.map(({ artist, links }) => (
          <section
            key={artist.id}
            aria-label={`${artist.name} orbit`}
            className="rounded-panel border border-line bg-surface-1 p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="type-sub text-text">{artist.name}</h3>
              <DemoBadge />
            </div>
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
