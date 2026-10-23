import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

export interface OrbitItem {
  key: string;
  name: string;
  /** Provider-hosted image, or null for a typographic disc. */
  imageUrl: string | null;
}

const MIN_SLOTS = 8;
const MAX_SLOTS = 16;

/** One slot per item when there are enough; short lists repeat whole, so no artist sits beside itself. */
function slotCount(items: number): number {
  if (items >= MIN_SLOTS) return Math.min(items, MAX_SLOTS);
  return items * Math.ceil(MIN_SLOTS / items);
}

/**
 * Decorative wheels of artist images that peek in from both page edges and
 * turn slowly, like a dial seen side-on. Purely ornamental: hidden from
 * assistive technology, never interactive, and still under reduced motion.
 *
 * `fixed` pins the wheels to the viewport so they hold still while the page
 * scrolls. `retracted` slides them back into the edges, far enough to clear
 * `retractWidth` of content, and off-screen when the viewport has no room.
 */
export function OrbitEdges({
  items,
  contentWidth = "64rem",
  retractWidth = "80rem",
  fixed = false,
  retracted = false,
  className,
}: {
  items: readonly OrbitItem[];
  /** Width of the page content the wheels must stay clear of. */
  contentWidth?: string;
  /** Content width to clear while retracted. */
  retractWidth?: string;
  fixed?: boolean;
  retracted?: boolean;
  /** Visibility classes; the wheels are hidden until a breakpoint shows them. */
  className?: string;
}) {
  if (items.length === 0) return null;
  const ring = Array.from({ length: slotCount(items.length) }, (_, i) => items[i % items.length] as OrbitItem);
  return (
    <div
      aria-hidden="true"
      data-retracted={retracted}
      className={cn(
        "orbit-edges pointer-events-none inset-0 -z-10 hidden overflow-hidden",
        fixed ? "fixed" : "absolute",
        className,
      )}
      style={{ "--orbit-content": contentWidth, "--orbit-retract": retractWidth } as CSSProperties}
    >
      <Wheel side="left" ring={ring} />
      <Wheel side="right" ring={[...ring].reverse()} />
    </div>
  );
}

function Wheel({ side, ring }: { side: "left" | "right"; ring: OrbitItem[] }) {
  return (
    <div className="orbit-wheel" data-side={side}>
      <div className="orbit-wheel__band" />
      <div className="orbit-wheel__spin">
        {ring.map((item, i) => (
          <div
            key={`${item.key}-${i}`}
            className="orbit-wheel__slot"
            style={{ "--a": `${(360 / ring.length) * i}deg` } as CSSProperties}
          >
            <div className="orbit-wheel__item">
              {item.imageUrl ? (
                // 88px discs: the 128w variant covers 1x and most 1.5x screens.
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={88}
                  height={88}
                  sizes="88px"
                  // The wheels sit at the viewport edge where lazy loading can leave blank discs;
                  // the URLs repeat across slots, so eager costs one small file per artist.
                  loading="eager"
                  fetchPriority="low"
                  className="size-full object-cover"
                />
              ) : (
                <span className="type-accent text-3xl text-mint">{item.name.charAt(0)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
