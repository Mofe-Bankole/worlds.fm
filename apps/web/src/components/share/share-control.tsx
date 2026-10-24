"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { resolveShareOrigin, type ShareTarget } from "@/lib/share";

type Status =
  | { kind: "idle" }
  | { kind: "copied" }
  /** Clipboard was unavailable or refused, so the link is shown to copy by hand. */
  | { kind: "manual"; url: string };

/**
 * Capability probe. Read through `useSyncExternalStore` so the server and the
 * first client render agree on `false`, and the real capability is picked up
 * after hydration without a hydration mismatch or an effect that sets state.
 */
const subscribeToNothing = () => () => {};
const hasNativeShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";
const neverHasNativeShare = () => false;

/**
 * Share one destination: an artist's World or a song.
 *
 * The link is built on demand from an origin, so nothing about the visitor or
 * the deployment is baked in. "Copy link" always works; the native share sheet
 * is offered only where the browser provides it. When the clipboard is
 * unavailable (an insecure origin, or a denied permission) the link is revealed
 * in a field the visitor can copy from, rather than failing silently.
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
   * Builds the payload for an origin. Called when the visitor shares, so the
   * URL uses the origin actually being viewed.
   */
  buildTarget: (origin: string) => ShareTarget;
  /** Accessible name for the revealed link field. */
  fieldLabel?: string;
  className?: string;
  note?: string | null;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const canNativeShare = useSyncExternalStore(
    subscribeToNothing,
    hasNativeShare,
    neverHasNativeShare,
  );
  const label = subject.trim();

  // Move focus into the revealed link so it can be copied with the keyboard.
  useEffect(() => {
    if (status.kind !== "manual") return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [status.kind]);

  const copy = useCallback(async () => {
    const { url } = buildTarget(resolveShareOrigin());
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(url);
      setStatus({ kind: "copied" });
    } catch {
      setStatus({ kind: "manual", url });
    }
  }, [buildTarget]);

  const share = useCallback(async () => {
    try {
      await navigator.share(buildTarget(resolveShareOrigin()));
      setStatus({ kind: "idle" });
    } catch (error) {
      // Dismissing the OS share sheet is a normal outcome, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus({ kind: "manual", url: buildTarget(resolveShareOrigin()).url });
    }
  }, [buildTarget]);

  if (label.length === 0) return null;

  const buttonClass =
    "inline-flex items-center gap-1.5 border border-line-strong px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-text-2 transition-colors hover:border-electric hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className={buttonClass}>
          {status.kind === "copied" ? (
            <Check aria-hidden="true" className="size-3.5" />
          ) : (
            <Copy aria-hidden="true" className="size-3.5" />
          )}
          {status.kind === "copied" ? "Link copied" : "Copy link"}
        </button>
        {canNativeShare ? (
          <button type="button" onClick={share} className={buttonClass}>
            <Share2 aria-hidden="true" className="size-3.5" />
            Share<span className="sr-only"> {label} using your device</span>
            <span aria-hidden="true">…</span>
          </button>
        ) : null}
      </div>

      {status.kind === "manual" ? (
        <div className="space-y-1">
          <label htmlFor={inputId} className="sr-only">
            {fieldLabel ?? `Link to ${label}`}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            readOnly
            value={status.url}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full border border-line-strong bg-night px-2.5 py-1.5 font-mono text-[0.6875rem] text-text-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
          />
        </div>
      ) : null}

      {/* Always present so assistive technology announces the change. */}
      <p role="status" aria-live="polite" className="min-h-4 text-[0.6875rem] font-semibold text-mint">
        {status.kind === "copied"
          ? "Link copied to the clipboard."
          : status.kind === "manual"
            ? "Copy the link below."
            : ""}
      </p>

      {note ? <p className="text-[0.6875rem] leading-relaxed text-text-3">{note}</p> : null}
    </div>
  );
}
