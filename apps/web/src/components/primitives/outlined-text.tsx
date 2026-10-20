import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface OutlinedTextProps {
  as?: ElementType;
  /** `subtle` stays faintly visible on Night; `mint` and `electric` are brighter. */
  tone?: "subtle" | "mint" | "electric";
  /** `solid` fills the letterforms (used for the lit state of a wordmark). */
  fill?: "none" | "solid";
  /** Hide from assistive technology when real text appears nearby. */
  decorative?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Display type drawn as a stroke with no fill. Pair with a type-* class for
 * size, for example `type-wordmark`. The stroke styling lives in
 * styles/surfaces.css so later phases can layer a lit copy on top.
 */
export function OutlinedText({
  as,
  tone = "subtle",
  fill = "none",
  decorative = false,
  className,
  children,
}: OutlinedTextProps) {
  const Component = as ?? "span";
  return (
    <Component
      data-tone={tone}
      data-fill={fill}
      aria-hidden={decorative ? true : undefined}
      className={cn("outlined-text", className)}
    >
      {children}
    </Component>
  );
}
