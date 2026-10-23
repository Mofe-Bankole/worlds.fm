import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Square-cornered editorial card: a small header line, a large visual, one
 * statement in large type, then a quiet text action. `forest` is the
 * highlighted surface; `night` is the default.
 */
export function SignalCard({
  tone = "night",
  header,
  media,
  statement,
  children,
  action,
  as: Tag = "article",
  className,
  ...rest
}: {
  tone?: "forest" | "night";
  header: ReactNode;
  media?: ReactNode;
  statement: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  as?: "article" | "aside" | "section";
  className?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
}) {
  return (
    <Tag data-tone={tone} className={cn("signal-card flex flex-col", className)} {...rest}>
      <div className="flex items-center justify-between gap-3 px-6 pt-6 sm:px-7 sm:pt-7">{header}</div>
      {media ? <div className="mt-5">{media}</div> : null}
      <div className="flex flex-1 flex-col gap-4 px-6 pb-6 pt-5 sm:px-7 sm:pb-7">
        <div className="text-[1.375rem] font-medium leading-[1.3] tracking-[-0.015em] text-text">{statement}</div>
        {children}
        {action ? <div className="mt-auto pt-2">{action}</div> : null}
      </div>
    </Tag>
  );
}

/** Text action in the card's footer: label plus an arrow that nudges on hover. */
export function SignalAction({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const body = (
    <>
      <span>{children}</span>
      <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
        →
      </span>
    </>
  );
  const cls =
    "group inline-flex items-center gap-2 text-sm font-medium text-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-electric";
  return href ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}
