import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SectionShellProps {
  id: string;
  /** Id of the heading that names this landmark. */
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/** Shared section container: landmark, vertical rhythm and max width. */
export function SectionShell({
  id,
  labelledBy,
  className,
  children,
}: SectionShellProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        "relative scroll-mt-24 py-[var(--layout-section-y)]",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[var(--layout-max)] px-[var(--layout-gutter)]">
        {children}
      </div>
    </section>
  );
}
