import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Image shown through fine vertical bars over a faint full copy, fading into
 * the card at the bottom. Without an image, `fallback` fills the frame.
 */
export function StripedImage({
  src,
  alt,
  fallback,
  sizes = "(min-width: 1280px) 20rem, 100vw",
  className,
}: {
  src: string | null;
  alt: string;
  fallback?: ReactNode;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={cn("striped-media relative aspect-[4/3] overflow-hidden", className)}>
      {src ? (
        <>
          <Image src={src} alt="" aria-hidden="true" fill sizes={sizes} className="object-cover opacity-25 grayscale" />
          <Image src={src} alt={alt} fill sizes={sizes} className="striped-media__bars object-cover" />
        </>
      ) : (
        fallback
      )}
      <div aria-hidden="true" className="striped-media__fade absolute inset-x-0 bottom-0 h-2/5" />
    </div>
  );
}
