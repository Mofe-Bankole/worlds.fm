"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { WorldsMark } from "@/components/worlds-mark";
import { cn } from "@/lib/cn";

const LINKS = [
  { label: "Explore", href: "#discovery" },
  { label: "How It Works", href: "#how" },
  { label: "About", href: "#about" },
] as const;

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled
          ? "border-b border-white/8 bg-ink/72 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:h-18"
      >
        <a
          href="#top"
          className="group flex items-center gap-2.5"
          aria-label="Worlds.fm home"
        >
          <WorldsMark className="size-8 transition-transform duration-500 group-hover:rotate-[12deg]" />
          <span className="text-lg font-extrabold tracking-[-0.03em]">
            Worlds<span className="text-brand">.fm</span>
          </span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-cloud/80 transition duration-300 hover:bg-white/[0.06] hover:text-cloud"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#discovery"
            className="ml-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-ink transition duration-300 hover:bg-electric hover:shadow-[0_0_28px_-6px_rgba(190,255,85,0.9)]"
          >
            Launch App
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-cloud transition hover:border-electric/40 md:hidden"
        >
          {open ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
        </button>
      </nav>

      <div
        id="mobile-menu"
        hidden={!open}
        className="border-t border-white/8 bg-ink/95 backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-base font-medium text-cloud/85 transition hover:bg-white/[0.06] hover:text-cloud"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#discovery"
            onClick={() => setOpen(false)}
            className="mt-2 rounded-xl bg-brand px-4 py-3 text-center text-base font-semibold text-ink transition hover:bg-electric"
          >
            Launch App
          </a>
        </div>
      </div>
    </header>
  );
}
