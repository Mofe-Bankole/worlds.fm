import type { SVGProps } from "react";

interface ContourFieldProps
  extends Omit<SVGProps<SVGSVGElement>, "children" | "viewBox" | "ref"> {
  /** Number of concentric rings. */
  rings?: number;
  /** How far each ring departs from a circle (0 = perfect circles). */
  wobble?: number;
  /** Changes the ring shapes. The same seed always renders the same field. */
  seed?: number;
  strokeWidth?: number;
}

const VIEW = 1000;
const POINTS = 96;

function ringPath(index: number, rings: number, wobble: number, seed: number) {
  const baseRadius = 70 + (index / Math.max(rings - 1, 1)) * 520;
  const phaseA = seed + index * 0.55;
  const phaseB = seed * 1.7 + index * 0.9;
  let d = "";
  for (let i = 0; i < POINTS; i += 1) {
    const theta = (i / POINTS) * Math.PI * 2;
    const radius =
      baseRadius *
      (1 +
        wobble * Math.sin(2 * theta + phaseA) +
        wobble * 0.5 * Math.sin(3 * theta + phaseB));
    const x = VIEW / 2 + radius * Math.cos(theta);
    const y = VIEW / 2 + radius * Math.sin(theta);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return `${d}Z`;
}

/**
 * Decorative concentric rings: a record groove, an orbit and a map contour at
 * once. Strokes use currentColor, so set the color with a text utility
 * (for example `text-mint/20`). Output is deterministic, so it is safe to
 * render on the server.
 *
 * Each ring is a <path data-contour-ring="n"> so later phases can animate them.
 */
export function ContourField({
  rings = 9,
  wobble = 0.035,
  seed = 1,
  strokeWidth = 1,
  className,
  ...rest
}: ContourFieldProps) {
  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {Array.from({ length: rings }, (_, index) => (
        <path
          key={index}
          data-contour-ring={index}
          d={ringPath(index, rings, wobble, seed)}
          vectorEffect="non-scaling-stroke"
          strokeOpacity={(0.95 - (index / rings) * 0.75).toFixed(2)}
        />
      ))}
    </svg>
  );
}
