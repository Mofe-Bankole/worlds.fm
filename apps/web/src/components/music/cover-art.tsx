"use client";

import Image from "next/image";
import { useState } from "react";
import type { CoverArt as Cover } from "@worlds/shared";
import { cn } from "@/lib/cn";

/**
 * Square release cover. Shown exactly as the provider serves it: no crop
 * beyond the square frame, no filter and no re-encoding (`unoptimized`),
 * because Spotify artwork must not be altered.
 */
export function CoverArt({
  cover,
  title,
  size = "small",
  sizes,
  className,
}: {
  cover: Cover | null;
  title: string;
  size?: "small" | "large";
  sizes: string;
  className?: string;
}) {
  const src = cover ? (size === "large" ? cover.largeUrl : cover.url) : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const show = src !== null && failedSrc !== src;
  return (
    <div className={cn("relative aspect-square overflow-hidden bg-surface-2", className)}>
      {show ? (
        <Image src={src} alt={`Cover of ${title}`} fill sizes={sizes} unoptimized className="object-cover" onError={() => setFailedSrc(src)} />
      ) : (
        <div className="absolute inset-0 flex flex-col justify-between border border-line p-3">
          <span aria-hidden="true" className="font-serif text-4xl leading-none text-text-3">
            {title.trim().charAt(0).toUpperCase()}
          </span>
          <span className="text-xs text-text-3">No cover available</span>
        </div>
      )}
    </div>
  );
}

export function coverCredit(cover: Cover | null): string | null {
  if (!cover) return null;
  return cover.provider === "spotify" ? "Cover via Spotify" : "Cover via Cover Art Archive";
}
