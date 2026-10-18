import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/reveal";

export function FinalCta() {
  return (
    <section className="px-6 py-16 sm:py-24">
      <Reveal className="mx-auto max-w-6xl">
        <div className="relative isolate overflow-hidden rounded-[2.5rem] border border-electric/20 px-6 py-20 text-center sm:px-12 sm:py-28">
          {/* Animated glowing background */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_120%_at_50%_120%,#103D2B_0%,#0B1210_60%,#080A09_100%)]" />
            <div className="absolute left-1/2 top-full size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/25 blur-[120px] animate-pulse-glow" />
            <div className="absolute left-1/4 top-1/4 size-72 rounded-full bg-electric/20 blur-[110px] animate-drift" />
            <div className="absolute right-1/4 bottom-1/4 size-72 rounded-full bg-forest/70 blur-[120px] animate-drift-slow" />
            <div className="absolute inset-0 grid-veil opacity-40" />
            <div className="absolute inset-0 noise opacity-[0.04] mix-blend-soft-light" />
          </div>

          <h2 className="mx-auto max-w-3xl text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
            Your next discovery starts with a sound.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg">
            Search a song. Step into its world. Follow the connections wherever
            they lead.
          </p>

          <div className="mt-10 flex justify-center">
            <a
              href="#discovery"
              className="group inline-flex items-center gap-2 rounded-full bg-brand px-8 py-4 text-base font-semibold text-ink transition duration-300 hover:bg-electric hover:shadow-[0_0_50px_-8px_rgba(190,255,85,0.9)] active:scale-[0.98]"
            >
              Explore Worlds.fm
              <ArrowRight
                aria-hidden="true"
                className="size-5 transition-transform duration-300 group-hover:translate-x-1"
              />
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
