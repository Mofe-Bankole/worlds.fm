import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SectionHeaderProps {
  /** Section number in mono, for example "02". */
  index?: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  headingLevel?: 1 | 2 | 3;
  align?: "start" | "center";
  id?: string;
  className?: string;
}

/**
 * Editorial section opener: mono index and eyebrow, a large heading, and an
 * optional supporting paragraph. Pass `id` to name the section landmark with
 * `aria-labelledby`.
 */
export function SectionHeader({
  index,
  eyebrow,
  title,
  description,
  headingLevel = 2,
  align = "start",
  id,
  className,
}: SectionHeaderProps) {
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3";

  return (
    <header
      className={cn(
        "flex max-w-3xl flex-col gap-5",
        align === "center" && "mx-auto items-center text-center",
        className,
      )}
    >
      <p className="type-eyebrow flex items-center gap-3 text-text-3">
        {index ? <span className="text-text-2">{index}</span> : null}
        {index ? <span aria-hidden="true">·</span> : null}
        <span>{eyebrow}</span>
      </p>
      <Heading id={id} className="type-section text-text">
        {title}
      </Heading>
      {description ? (
        <p className="type-lead max-w-2xl text-text-2">{description}</p>
      ) : null}
    </header>
  );
}
