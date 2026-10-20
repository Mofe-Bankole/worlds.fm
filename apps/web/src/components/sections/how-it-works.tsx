import { SectionHeader } from "@/components/primitives/section-header";
import { HOW_IT_WORKS } from "@/content/landing";
import { SectionShell } from "./section-shell";

export function HowItWorks() {
  return (
    <SectionShell id="how" labelledBy="how-heading">
      <SectionHeader
        index="06"
        eyebrow="How it works"
        id="how-heading"
        title="Three steps from a sound to a world."
      />

      <ol className="relative mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
        <span
          aria-hidden="true"
          className="absolute left-5 top-5 hidden h-px w-[calc(100%-2.5rem)] bg-gradient-to-r from-electric/60 via-forest to-transparent md:block"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-5 top-5 w-px bg-gradient-to-b from-electric/60 to-transparent md:hidden"
        />
        {HOW_IT_WORKS.map((step) => (
          <li key={step.id} className="relative pl-16 md:pl-0 md:pt-16">
            <span className="absolute left-0 top-0 grid size-10 place-items-center rounded-full border border-electric bg-night font-mono text-xs text-electric">
              {step.index}
            </span>
            <h3 className="type-sub text-text">{step.title}</h3>
            <p className="type-body mt-3 max-w-xs text-text-2">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}
