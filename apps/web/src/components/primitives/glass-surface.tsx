import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "@/lib/cn";

type GlassTag = "div" | "nav" | "header" | "section" | "aside" | "form";

type GlassSurfaceProps<T extends GlassTag> = {
  as?: T;
  /** `strong` raises opacity for surfaces that sit over busy imagery. */
  tone?: "default" | "strong";
  radius?: "panel" | "field" | "full";
  /** Soft light along the top edge. */
  highlight?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as">;

/**
 * Translucent Liquid Glass surface. Reserve it for navigation, the hero
 * search, carousel controls, the orbit detail card and mobile sheets. Do not
 * use it for bento or gallery cards.
 *
 * Legibility first: the surface keeps enough opacity for text, falls back to a
 * near-opaque fill without backdrop-filter, and turns solid when the visitor
 * prefers reduced transparency (all in styles/surfaces.css).
 */
export function GlassSurface<T extends GlassTag = "div">({
  as,
  tone = "default",
  radius = "panel",
  highlight = true,
  className,
  ...rest
}: GlassSurfaceProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      data-tone={tone}
      data-radius={radius}
      data-highlight={highlight}
      className={cn("glass-surface", className)}
      {...rest}
    />
  );
}
