"use client";

import { useEffect, useState } from "react";
import { OrbitEdges } from "@/components/primitives/orbit-edges";
import { ORBIT_ARTISTS } from "@/content/landing";
import { useArtistImages } from "@/lib/use-artist-images";

/** Id of the element whose arrival retracts the wheels into the page edges. */
export const ORBIT_RETRACT_TARGET = "featured-worlds";

/**
 * Viewport-fixed artist wheels for the landing page. Wide open beside the
 * narrow hero, then retracted to the gutters once the full-width carousel
 * reaches the reading zone, and kept there for the rest of the page.
 */
export function LandingOrbit() {
  const images = useArtistImages(ORBIT_ARTISTS);
  const [retracted, setRetracted] = useState(false);

  useEffect(() => {
    const target = document.getElementById(ORBIT_RETRACT_TARGET);
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setRetracted(entry.isIntersecting || entry.boundingClientRect.top < 0);
      },
      { rootMargin: "0px 0px -35% 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // Once lookups land, show only artists Qloo had a picture for.
  const pictured = images.filter((item) => item.imageUrl);
  return (
    <OrbitEdges
      items={pictured.length > 0 ? pictured : images}
      contentWidth="52rem"
      fixed
      retracted={retracted}
      className="md:block"
    />
  );
}
