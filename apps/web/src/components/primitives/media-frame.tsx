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

const PLACEHOLDER_TONE: Record<PlaceholderAsset["tone"], string> = {
  forest:
    "bg-[linear-gradient(160deg,var(--color-forest),var(--color-night)_78%)]",
  mint: "bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-mint)_30%,var(--color-surface-1)),var(--color-night)_78%)]",
  night: "bg-[linear-gradient(160deg,var(--color-surface-2),var(--color-night)_78%)]",
};

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
          <div
            role="img"
            aria-label={media.alt}
            className={cn("absolute inset-0", PLACEHOLDER_TONE[media.tone])}
          >
            <ContourField
              rings={11}
              seed={media.label.length}
              className="absolute inset-0 size-full text-mint/25"
            />
            <span
              aria-hidden="true"
              className="type-sub absolute inset-x-5 bottom-5 text-text"
            >
              {media.label}
            </span>
          </div>
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
