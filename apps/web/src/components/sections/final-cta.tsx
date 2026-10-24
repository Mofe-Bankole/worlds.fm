import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ContourField } from "@/components/primitives/contour-field";
import { SectionShell } from "./section-shell";

export function FinalCta() {
  return (
    <SectionShell id="cta" labelledBy="cta-heading" className="isolate overflow-hidden text-center">
      <ContourField
        rings={10}
        seed={5}
        className="absolute left-1/2 top-1/2 -z-10 size-[130vmin] max-w-none -translate-x-1/2 -translate-y-1/2 text-mint/12"
      />
      <h2 id="cta-heading" className="type-cta mx-auto max-w-4xl text-text">
        Your next discovery starts with a <span className="type-accent text-mint">sound.</span>
      </h2>
      <p className="type-lead mx-auto mt-6 max-w-xl text-text-2">
        Search an artist. Step into their world. Follow the links, and check the
        evidence.
      </p>
      <Link
        href="/explore"
        className="group mt-10 inline-flex items-center gap-3 rounded-full bg-electric px-9 py-4 text-base font-semibold text-on-accent transition hover:bg-fresh hover:shadow-glow-md active:scale-[0.98]"
      >
        Start exploring
        <ArrowRight
          aria-hidden="true"
          className="size-5 transition-transform group-hover:translate-x-1"
        />
      </Link>
    </SectionShell>
  );
}
