"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { WorldsMark } from "@/components/worlds-mark";
import { GlassSurface } from "@/components/primitives/glass-surface";

const LINKS = [
  { label: "Discover", href: "#discovery" },
  { label: "Features", href: "#features" },
  { label: "Orbit", href: "#orbit" },
  { label: "How it works", href: "#how" },
] as const;

export function SiteNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-[var(--z-nav)] px-3 pt-3 sm:px-6 sm:pt-5">
      <GlassSurface
        as="nav"
        radius="full"
        aria-label="Primary"
        className="mx-auto flex max-w-5xl items-center justify-between gap-4 py-2 pl-5 pr-2"
      >
        <a
          href="#top"
          className="flex items-center gap-2.5"
          aria-label="Worlds.fm home"
        >
          <WorldsMark className="size-7" />
          <span className="text-base font-extrabold tracking-[-0.03em]">
            Worlds<span className="text-electric">.fm</span>
          </span>
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-text-2 transition-colors hover:text-text"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/explore"
            className="hidden rounded-full bg-electric px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-fresh hover:shadow-glow-sm sm:inline-block"
          >
            Start exploring
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid size-10 place-items-center rounded-full border border-line-strong text-text md:hidden"
          >
            {open ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </GlassSurface>

      <GlassSurface
        id="mobile-menu"
        tone="strong"
        hidden={!open}
        className="mx-auto mt-2 max-w-5xl p-3 md:hidden"
      >
        <ul className="flex flex-col">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-4 py-3 text-base font-medium text-text-2 hover:text-text"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <Link
              href="/explore"
              onClick={() => setOpen(false)}
              className="mt-2 block rounded-full bg-electric px-4 py-3 text-center text-base font-semibold text-on-accent"
            >
              Start exploring
            </Link>
          </li>
        </ul>
      </GlassSurface>
    </header>
  );
}
