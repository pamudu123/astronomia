import type { SVGProps } from "react";

import { SPOTS, type SpotLayer, type SpotName } from "@/lib/spots";

/**
 * A spot illustration (lib/spots.ts, drawn by design/tools/gen_spots.py): a small gold line
 * picture with a teal accent, in the site's colours, so it follows the light and dark theme.
 * The same drawings exist as files in public/images/spots/ for use outside the page.
 *
 * `cover` shapes hide what is behind them (a planet in front of its ring); they are filled
 * with --spot-bg, which a container sets to its own background.
 */
const STROKE = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

const PAINT: Record<SpotLayer, SVGProps<SVGPathElement>> = {
  back: { ...STROKE, stroke: "var(--line)", strokeWidth: 0.8 },
  line: { ...STROKE, stroke: "var(--gold)", strokeWidth: 2.2 },
  accent: { ...STROKE, stroke: "var(--teal)", strokeWidth: 2 },
  dash: { ...STROKE, stroke: "var(--teal)", strokeWidth: 1.6, strokeDasharray: "3 4" },
  fill: { fill: "var(--gold)" },
  afill: { fill: "var(--teal)" },
  dot: { fill: "var(--mist)" },
  cover: { fill: "var(--spot-bg, var(--panel))", stroke: "var(--gold)", strokeWidth: 2.2 },
};

export function Spot({ name, className }: { name: SpotName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 80" aria-hidden="true" focusable="false" data-spot={name}>
      {SPOTS[name].map(([kind, d], index) => (
        <path key={index} d={d} {...PAINT[kind as SpotLayer]} />
      ))}
    </svg>
  );
}
