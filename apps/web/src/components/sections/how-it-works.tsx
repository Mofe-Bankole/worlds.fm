import { OutlinedText } from "@/components/primitives/outlined-text";
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

      <ol className="mt-16 grid gap-6 md:grid-cols-3">
        {HOW_IT_WORKS.map((step) => (
          <li
            key={step.id}
            className="relative overflow-hidden rounded-panel border border-line bg-surface-1 p-8 pt-6"
          >
            <OutlinedText
              decorative
              tone="mint"
              className="type-hero block !text-[clamp(5rem,12vw,9rem)] leading-none"
            >
              {step.index}
            </OutlinedText>
            <h3 className="type-sub mt-6 text-text">{step.title}</h3>
            <p className="type-body mt-3 max-w-xs text-text-2">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}
