import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { Universe } from "@/components/universe";
import { DiscoveryPreview } from "@/components/discovery-preview";
import { HowItWorks } from "@/components/how-it-works";
import { FinalCta } from "@/components/final-cta";
import { Footer } from "@/components/footer";
import { ExplorerProvider } from "@/components/explorer-context";

export default function Home() {
  return (
    <ExplorerProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-electric focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Universe />
        <DiscoveryPreview />
        <HowItWorks />
        <FinalCta />
      </main>
      <Footer />
    </ExplorerProvider>
  );
}
