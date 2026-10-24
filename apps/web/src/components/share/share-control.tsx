"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { resolveShareOrigin, type ShareTarget } from "@/lib/share";
import { ShareDialog } from "./share-dialog";

/**
 * Share one destination: an artist's World or a song.
 *
 * The link is built on demand from an origin, so nothing about the visitor or
 * the deployment is baked in. "Share" opens a sheet of documented per-service
 * share endpoints plus a plain copy, which is the option that always works.
 */
export function ShareControl({
  subject,
  buildTarget,
  fieldLabel,
  className,
  note = "Anyone with this link sees this world. Nothing personal is included.",
}: {
  /** What is being shared: an artist name or a song title. Used in labels. */
  subject: string;
  /**
   * Builds the payload for an origin. Called when the visitor opens the sheet,
   * so the URL uses the origin actually being viewed.
   */
  buildTarget: (origin: string) => ShareTarget;
  /** Accessible name for the revealed link field. */
  fieldLabel?: string;
  className?: string;
  note?: string | null;
}) {
  const [target, setTarget] = useState<ShareTarget | null>(null);
  const label = subject.trim();

  if (label.length === 0) return null;

  const buttonClass =
    "inline-flex items-center gap-1.5 border border-line-strong px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-text-2 transition-colors hover:border-electric hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric";

  return (
    <div className={cn(className)}>
      <button
        type="button"
        onClick={() => setTarget(buildTarget(resolveShareOrigin()))}
        aria-haspopup="dialog"
        className={buttonClass}
      >
        <Share2 aria-hidden="true" className="size-3.5" />
        Share<span className="sr-only"> {label}</span>
      </button>

      <ShareDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        target={target}
        subject={label}
        fieldLabel={fieldLabel}
        note={note}
      />
    </div>
  );
}
