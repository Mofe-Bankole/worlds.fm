import Image from "next/image";
import type { MediaAsset, MediaCredit, PlaceholderAsset } from "@/content/types";
import { cn } from "@/lib/cn";
import { ContourField } from "./contour-field";

const ASPECT = {
  portrait: "aspect-[3/4]",
  landscape: "aspect-[4/3]",
  square: "aspect-square",
  wide: "aspect-video",
} as const;

interface ToneStyle {
  surface: string;
  ink: string;
  contour: string;
  outline: string;
}

const PLACEHOLDER_TONE: Record<PlaceholderAsset["tone"], ToneStyle> = {
  forest: {
    surface:
      "bg-[linear-gradient(160deg,var(--color-forest),var(--color-night)_80%)]",
    ink: "text-mint",
    contour: "text-mint/25",
    outline: "var(--color-mint)",
  },
  mint: {
    surface: "bg-mint",
    ink: "text-night",
    contour: "text-night/20",
    outline: "var(--color-night)",
  },
  night: {
    surface:
      "bg-[linear-gradient(180deg,var(--color-surface-2),var(--color-night))]",
    ink: "text-text",
    contour: "text-mint/20",
    outline: "var(--color-mint)",
  },
  electric: {
    surface:
      "bg-[linear-gradient(200deg,color-mix(in_oklab,var(--color-electric)_45%,var(--color-night)),var(--color-forest)_55%,var(--color-night))]",
    ink: "text-text",
    contour: "text-mint/30",
    outline: "var(--color-text)",
  },
};

/** Where the contour terrain sits, per layout, so covers do not look alike. */
const CONTOUR_POSITION: Record<PlaceholderAsset["layout"], string> = {
  initial: "-right-1/4 -top-1/4 size-[120%]",
  stack: "-bottom-1/3 -left-1/4 size-[130%]",
  vertical: "left-[-10%] top-[-5%] size-[130%]",
  place: "left-0 top-[-20%] size-full",
};

/** Typographic cover for an artist with no licensed photograph yet. */
function PlaceholderArt({ media }: { media: PlaceholderAsset }) {
  const tone = PLACEHOLDER_TONE[media.tone];
  const name = media.label;
  const words = name.toUpperCase().split(" ");
  const longest = Math.max(...words.map((word) => word.length));
  const outline = {
    WebkitTextStroke: `1.5px ${tone.outline}`,
    WebkitTextFillColor: "transparent",
  } as const;

  return (
    <div
      role="img"
      aria-label={media.alt}
      className={cn(
        "absolute inset-0 overflow-hidden [container-type:size]",
        tone.surface,
        tone.ink,
      )}
    >
      <ContourField
        rings={12}
        seed={media.seed}
        wobble={0.05}
        className={cn("absolute max-w-none", tone.contour, CONTOUR_POSITION[media.layout])}
      />
      <div aria-hidden="true" className="absolute inset-0 select-none">
        {media.layout === "initial" ? (
          <>
            <span className="type-accent absolute -bottom-[8cqw] -left-[3cqw] text-[min(100cqw,82cqh)] leading-none">
              {name.charAt(0)}
            </span>
            <span className="absolute left-[6cqw] top-[6cqw] flex flex-col gap-[1.5cqw]">
              <span className="type-eyebrow opacity-90">{media.kicker}</span>
              <span className="type-sub">{name}</span>
            </span>
          </>
        ) : null}

        {media.layout === "stack" ? (
          <>
            <span className="type-eyebrow absolute right-[6cqw] top-[6cqw] opacity-80">
              {media.kicker}
            </span>
            <span
              className="absolute inset-x-[6cqw] bottom-[6cqw] flex flex-col font-extrabold uppercase leading-[0.84] tracking-[-0.04em]"
              style={{ fontSize: `${Math.min(34, 86 / (longest * 0.74))}cqw` }}
            >
              {words.map((word) => (
                <span key={word}>{word}</span>
              ))}
            </span>
          </>
        ) : null}

        {media.layout === "vertical" ? (
          <>
            <span
              className="absolute bottom-[6cqh] right-[6cqw] font-extrabold uppercase leading-none tracking-[-0.03em] [text-orientation:mixed] [writing-mode:vertical-rl]"
              style={{
                ...outline,
                transform: "rotate(180deg)",
                fontSize: `${Math.min(26, 88 / (name.length * 0.72))}cqh`,
              }}
            >
              {name}
            </span>
            <span className="type-eyebrow absolute left-[6cqw] top-[6cqw] opacity-90">
              {media.kicker}
            </span>
          </>
        ) : null}

        {media.layout === "place" ? (
          <>
            <span
              className="absolute inset-x-[5cqw] top-1/2 -translate-y-1/2 text-center font-extrabold uppercase leading-none tracking-[-0.04em]"
              style={{
                ...outline,
                fontSize: `${Math.min(34, 90 / (media.kicker.length * 0.74))}cqw`,
              }}
            >
              {media.kicker}
            </span>
            <span className="type-sub absolute bottom-[6cqw] left-[6cqw]">
              {name}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

interface MediaFrameProps {
  media: MediaAsset;
  aspect?: keyof typeof ASPECT;
  /** Required for responsive images. Describe the rendered width. */
  sizes?: string;
  /** Only for the first image or two above the fold. */
  priority?: boolean;
  /**
   * `caption` puts the credit under the frame, `overlay` puts it on the image
   * over a scrim, `none` omits it (only when the credit appears elsewhere
   * on the page, such as a gallery credits list).
   */
  credit?: "caption" | "overlay" | "none";
  className?: string;
}

/** Plain-text credit line, for lists such as the footer. */
export function MediaCreditLine({ credit }: { credit: MediaCredit }) {
  return (
    <>
      Photo: {credit.author} ·{" "}
      <a
        href={credit.licenseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-text"
      >
        {credit.licenseName}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>{" "}
      ·{" "}
      <a
        href={credit.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-text"
      >
        Source
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {credit.modifications.length > 0
        ? ` · Modified: ${credit.modifications.join(", ")}`
        : null}
    </>
  );
}

/**
 * Photograph with its attribution, or a designed placeholder when no licensed
 * photograph has been verified. Never render an image without its credit
 * somewhere on the page.
 */
export function MediaFrame({
  media,
  aspect = "portrait",
  sizes,
  priority = false,
  credit = "caption",
  className,
}: MediaFrameProps) {
  const showCredit = media.kind === "image" && credit !== "none";

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      <div
        className={cn(
          "relative isolate overflow-hidden rounded-panel bg-surface-1",
          ASPECT[aspect],
        )}
      >
        {media.kind === "image" ? (
          <Image
            src={media.src}
            alt={media.alt}
            width={media.width}
            height={media.height}
            sizes={sizes}
            priority={priority}
            placeholder={media.blurDataURL ? "blur" : "empty"}
            blurDataURL={media.blurDataURL}
            className="size-full object-cover"
          />
        ) : (
          <PlaceholderArt media={media} />
        )}

        {showCredit && credit === "overlay" && media.kind === "image" ? (
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/90 to-transparent px-4 pb-3 pt-10 text-[0.6875rem] leading-snug text-text-2">
            <MediaCreditLine credit={media.credit} />
          </figcaption>
        ) : null}
      </div>

      {showCredit && credit === "caption" && media.kind === "image" ? (
        <figcaption className="text-xs leading-snug text-text-3">
          <MediaCreditLine credit={media.credit} />
        </figcaption>
      ) : null}
    </figure>
  );
}
