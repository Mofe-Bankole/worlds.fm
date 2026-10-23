import { ExplorerProvider } from "@/components/explorer-context";
import { ArtistDiscovery } from "@/components/sections/artist-discovery";
import { CulturalOrbit } from "@/components/sections/cultural-orbit";
import { EditorialGallery } from "@/components/sections/editorial-gallery";
import { FeatureBento } from "@/components/sections/feature-bento";
import { FinalCta } from "@/components/sections/final-cta";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { LandingOrbit } from "@/components/sections/landing-orbit";
import { LandingStateProvider } from "@/components/sections/landing-state";
import { SiteFooter } from "@/components/sections/site-footer";
import { SiteNav } from "@/components/sections/site-nav";

export default function Home() {
  return (
    <ExplorerProvider>
      <LandingStateProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-electric focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-on-accent"
        >
          Skip to content
        </a>
        <LandingOrbit />
        <SiteNav />
        <main id="main">
          <Hero />
          <ArtistDiscovery />
          <FeatureBento />
          <CulturalOrbit />
          <EditorialGallery />
          <HowItWorks />
          <FinalCta />
        </main>
        <SiteFooter />
      </LandingStateProvider>
    </ExplorerProvider>
  );
}
