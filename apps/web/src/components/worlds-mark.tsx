import type { SVGProps } from "react";

/**
 * Worlds.fm brand mark — an original "sound globe": a globe outline whose
 * meridians are drawn as an equaliser, with a small orbiting signal dot.
 */
export function WorldsMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="worlds-mark" x1="4" y1="6" x2="36" y2="34">
          <stop offset="0%" stopColor="#BEFF55" />
          <stop offset="55%" stopColor="#1ED760" />
          <stop offset="100%" stopColor="#0F9E4A" />
        </linearGradient>
      </defs>
      <circle
        cx="20"
        cy="20"
        r="15.25"
        stroke="url(#worlds-mark)"
        strokeWidth="1.8"
        opacity="0.85"
      />
      <g fill="url(#worlds-mark)">
        <rect x="11.4" y="17" width="2.2" height="6" rx="1.1" />
        <rect x="15.9" y="14.2" width="2.2" height="11.6" rx="1.1" />
        <rect x="20.4" y="11.6" width="2.2" height="16.8" rx="1.1" />
        <rect x="24.9" y="14.2" width="2.2" height="11.6" rx="1.1" />
        <rect x="29.4" y="17" width="2.2" height="6" rx="1.1" opacity="0.75" />
      </g>
      <ellipse
        cx="20"
        cy="20"
        rx="15.25"
        ry="6.2"
        stroke="url(#worlds-mark)"
        strokeWidth="1"
        opacity="0.28"
      />
      <circle cx="34.4" cy="11.2" r="2.5" fill="#BEFF55" />
      <circle cx="34.4" cy="11.2" r="4.6" fill="#BEFF55" opacity="0.22" />
    </svg>
  );
}
