"use client";

import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

/**
 * Single registration point for GSAP. Import gsap and its plugins from here,
 * never from "gsap" directly, so plugins are registered exactly once and only
 * in the browser. Client components only.
 *
 * GSAP is free under its "no charge" licence (https://gsap.com/standard-license),
 * which covers this project. Do not use it to build a competing visual
 * animation tool.
 */
let registered = false;

export function registerGsap() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip);
  registered = true;
}

registerGsap();

export { gsap, Flip, ScrollTrigger, SplitText, useGSAP };
