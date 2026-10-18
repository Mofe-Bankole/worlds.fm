import { Compass, Route, Search } from "lucide-react";
import { Reveal } from "@/components/reveal";

const STEPS = [
  {
    number: "01",
    title: "Start with a sound",
    body: "Search an artist, song, or cultural interest. Every journey begins with a single signal.",
    icon: Search,
  },
  {
    number: "02",
    title: "Follow the connections",
    body: "Discover the places, people, and cultures behind it — cities, venues, movements, and moments.",
    icon: Route,
  },
  {
    number: "03",
    title: "Explore a new world",
    body: "Experience music through immersive cultural journeys, on the map and beyond.",
    icon: Compass,
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how"
      aria-labelledby="how-heading"
      className="relative scroll-mt-24 px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-electric/80">
            How Worlds.fm works
          </p>
          <h2
            id="how-heading"
            className="mt-3 text-4xl font-extrabold tracking-[-0.035em] sm:text-5xl"
          >
            From a single song to an entire universe
          </h2>
        </Reveal>

        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal as="li" key={step.number} delay={index * 120}>
                <div className="group relative h-full overflow-hidden rounded-4xl border border-white/8 bg-surface/60 p-7 transition duration-500 hover:-translate-y-1 hover:border-electric/30 sm:p-8">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-10 -top-14 size-40 rounded-full bg-brand/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                  />
                  <div className="relative flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-2xl border border-electric/25 bg-electric/[0.07] text-electric transition duration-500 group-hover:scale-105 group-hover:bg-electric/15">
                      <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                    </span>
                    <span className="font-mono text-2xl font-bold text-white/10 transition-colors duration-500 group-hover:text-electric/30">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="relative mt-6 text-xl font-bold tracking-[-0.02em]">
                    {step.title}
                  </h3>
                  <p className="relative mt-2.5 text-sm leading-relaxed text-muted">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
