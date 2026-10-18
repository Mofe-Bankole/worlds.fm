"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useReveal } from "@/lib/use-reveal";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Delay in milliseconds before the reveal transition starts. */
  delay?: number;
  as?: "div" | "section" | "li";
}

export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: RevealProps) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const Tag = as;

  return (
    <Tag
      ref={ref as never}
      data-visible={visible}
      className={cn("reveal", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
