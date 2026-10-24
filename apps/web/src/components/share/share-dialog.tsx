"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import { shareChannelUrl, type ShareChannel, type ShareTarget } from "@/lib/share";
import { BrandIcon } from "./brand-icons";

const CHANNELS: ReadonlyArray<{ id: ShareChannel; label: string }> = [
  // Google's only share target is Gmail compose, so the tile says what opens.
  { id: "google", label: "Gmail" },
  { id: "telegram", label: "Telegram" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
];

type Status =
  | { kind: "idle" }
  | { kind: "copied" }
  /** Clipboard was unavailable or refused, so the link is shown to copy by hand. */
  | { kind: "manual" };

/**
 * Capability probe. Read through `useSyncExternalStore` so the server and the
 * first client render agree on `false`, and the real capability is picked up
 * after hydration without a mismatch or an effect that sets state.
 */
const subscribeToNothing = () => () => {};
const hasNativeShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";
const neverHasNativeShare = () => false;

const TILE =
  "group flex flex-col items-center gap-2 border border-line bg-surface-1 px-2 py-3.5 text-[0.6875rem] font-semibold text-text-2 transition-colors hover:border-electric hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric";

/**
 * Share sheet for one destination (a World or a song).
 *
 * A native `<dialog>` is used so the platform supplies the focus trap, the top
 * layer (no clipping inside a card), Escape-to-close and focus restoration.
 * Each service opens its own documented endpoint in a new tab; nothing is
 * embedded, so no third-party script runs on the page.
 *
 * Instagram publishes no web share endpoint, so that tile copies the link and
 * says so rather than opening a page that cannot prefill anything.
 */
export function ShareDialog({
  open,
  onClose,
  target,
  subject,
  note,
  fieldLabel,
}: {
  open: boolean;
  onClose: () => void;
  /** Null while the sheet is closed, so no provider link is built for nobody. */
  target: ShareTarget | null;
  subject: string;
  note?: string | null;
  fieldLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const inputId = useId();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [notice, setNotice] = useState("");
  const canNativeShare = useSyncExternalStore(
    subscribeToNothing,
    hasNativeShare,
    neverHasNativeShare,
  );
  const label = subject.trim();

  // Drive the native modal from React state. The last result is cleared on
  // close rather than on open, so a reopened sheet never shows a stale
  // "copied" and no state is set while rendering.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setStatus({ kind: "idle" });
    setNotice("");
    onClose();
  }, [onClose]);

  // The modal pauses the page behind it, so stop that page from scrolling.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // The manual field is the fallback when the clipboard is refused: focus it so
  // the link can be copied with the keyboard.
  useEffect(() => {
    if (status.kind !== "manual") return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [status.kind]);

  const copy = useCallback(async () => {
    if (!target) return false;
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(target.url);
      setStatus({ kind: "copied" });
      setNotice("Link copied to the clipboard.");
      return true;
    } catch {
      setStatus({ kind: "manual" });
      setNotice("Copy the link below.");
      return false;
    }
  }, [target]);

  const shareToInstagram = useCallback(async () => {
    // Open first, while the click still counts as a user gesture.
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    const copied = await copy();
    if (copied) setNotice("Link copied. Paste it into an Instagram DM or story.");
  }, [copy]);

  const nativeShare = useCallback(async () => {
    if (!target) return;
    try {
      await navigator.share(target);
      handleClose();
    } catch (error) {
      // Dismissing the OS sheet is a normal outcome, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy();
    }
  }, [copy, handleClose, target]);

  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) handleClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onClick={onBackdropClick}
      aria-labelledby={titleId}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] max-w-none border border-line-strong bg-surface-1 p-0 text-text shadow-lift backdrop:bg-night/85 backdrop:backdrop-blur-sm"
    >
      {target ? (
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id={titleId}
                tabIndex={-1}
                autoFocus
                className="text-lg font-bold tracking-[-0.02em] outline-none"
              >
                Share
              </h2>
              {label ? <p className="mt-1 truncate text-sm text-text-2">{label}</p> : null}
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close share options"
              className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center text-text-2 transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {CHANNELS.map(({ id, label: channelLabel }) => {
              const href = shareChannelUrl(id, target);

              if (!href) {
                return (
                  <button key={id} type="button" onClick={shareToInstagram} className={TILE}>
                    <BrandIcon brand={id} className="size-6" />
                    {channelLabel}
                    <span className="sr-only"> — copies the link to paste into the app</span>
                  </button>
                );
              }

              return (
                <a
                  key={id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleClose}
                  className={TILE}
                >
                  <BrandIcon brand={id} className="size-6" />
                  {channelLabel}
                </a>
              );
            })}

            <button type="button" onClick={copy} className={TILE}>
              {status.kind === "copied" ? (
                <Check aria-hidden="true" className="size-6 text-mint" />
              ) : (
                <Copy aria-hidden="true" className="size-6" />
              )}
              {status.kind === "copied" ? "Copied" : "Copy link"}
            </button>
          </div>

          {canNativeShare ? (
            <button
              type="button"
              onClick={nativeShare}
              className="mt-2 flex w-full items-center justify-center gap-2 border border-line px-3 py-2.5 text-xs font-semibold text-text-2 transition-colors hover:border-electric hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
            >
              <Share2 aria-hidden="true" className="size-3.5" />
              More options on this device
            </button>
          ) : null}

          {status.kind === "manual" ? (
            <div className="mt-3 space-y-1">
              <label htmlFor={inputId} className="sr-only">
                {fieldLabel ?? `Link to ${label || "this page"}`}
              </label>
              <input
                id={inputId}
                ref={inputRef}
                readOnly
                value={target.url}
                onFocus={(event) => event.currentTarget.select()}
                className="w-full border border-line-strong bg-night px-2.5 py-1.5 font-mono text-[0.6875rem] text-text-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
              />
            </div>
          ) : null}

          {/* Always present so assistive technology announces the change. */}
          <p
            role="status"
            aria-live="polite"
            className="mt-3 min-h-4 text-[0.6875rem] font-semibold text-mint"
          >
            {status.kind === "idle" ? "" : notice}
          </p>

          {note ? (
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-text-3">{note}</p>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
