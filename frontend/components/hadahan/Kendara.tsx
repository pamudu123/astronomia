import type { Labels, Planet } from "@/lib/hadahan";

import styles from "./Kendara.module.css";

/**
 * The Sri Lankan square kendara. House 1 (the lagna) is the box at the top centre, and
 * houses run anticlockwise: 2 and 3 in the top left corner, 4 on the left, and so on.
 * PROVISIONAL: the direction is waiting for an astrologer's confirmation (docs/08).
 *
 * Each entry is the centre of a house, in a 300 x 300 drawing.
 */
const HOUSE_CENTRES: Record<number, [number, number]> = {
  1: [150, 56],
  2: [68, 30],
  3: [30, 68],
  4: [50, 150],
  5: [30, 232],
  6: [68, 270],
  7: [150, 250],
  8: [232, 270],
  9: [270, 232],
  10: [250, 150],
  11: [270, 68],
  12: [232, 30],
};
const TRIANGLES = new Set([2, 3, 5, 6, 8, 9, 11, 12]);
const LINES =
  "M0 0H300V300H0ZM100 0V300M200 0V300M0 100H300M0 200H300M0 0L100 100M300 0L200 100M0 300L100 200M300 300L200 200";

/** What the drawing needs to place a planet. */
export type Placed = Pick<Planet, "body" | "house" | "navamsha_house">;

type Props = {
  planets: Placed[];
  /** Only the planet and house names are used. */
  labels: Pick<Labels, "planet" | "house">;
  mode: "rashi" | "navamsha";
  title: string;
  ariaLabel: string;
  lagnaMark: string;
  highlight?: string | string[];
  subtitle: string;
};

export function Kendara({ planets, labels, mode, title, ariaLabel, lagnaMark, highlight, subtitle }: Props) {
  const marked = highlight === undefined ? [] : [highlight].flat();
  const byHouse = new Map<number, Placed[]>();
  for (const planet of planets) {
    const house = mode === "rashi" ? planet.house : planet.navamsha_house;
    byHouse.set(house, [...(byHouse.get(house) ?? []), planet]);
  }

  const description =
    ariaLabel +
    " " +
    [...byHouse.entries()]
      .sort(([a], [b]) => a - b)
      .map(([house, list]) => `${labels.house[house - 1]}: ${list.map((p) => labels.planet[p.body].name).join(", ")}`)
      .join(". ");

  return (
    <svg className={styles.chart} role="img" aria-label={description} viewBox="-4 -4 308 308">
      <rect x="101" y="1" width="98" height="98" className={styles.lagnaBox} />
      <path d={LINES} className={styles.lines} />
      <text x="150" y="20" className={styles.lagnaMark}>
        {lagnaMark}
      </text>
      {[...byHouse.entries()].map(([house, list]) => {
        const [cx, cy] = HOUSE_CENTRES[house];
        const step = TRIANGLES.has(house) ? 15 : 19;
        const columns = !TRIANGLES.has(house) && list.length > 4 ? 2 : 1;
        const rows = Math.ceil(list.length / columns);
        const top = cy - ((rows - 1) * step) / 2 + (house === 1 ? 8 : 0);
        return list.map((planet, index) => {
          const column = columns === 2 ? index % 2 : 0;
          const row = columns === 2 ? Math.floor(index / 2) : index;
          const x = columns === 2 ? cx + (column === 0 ? -16 : 16) : cx;
          return (
            <text
              key={planet.body}
              x={x}
              y={top + row * step}
              className={marked.includes(planet.body) ? styles.highlight : styles.planet}
              style={{ animationDelay: `${0.9 + index * 0.08 + house * 0.04}s` }}
            >
              {labels.planet[planet.body].short}
            </text>
          );
        });
      })}
      <text x="150" y="146" className={styles.centreTitle}>
        {title}
      </text>
      <text x="150" y="166" className={styles.centreSub}>
        {subtitle}
      </text>
    </svg>
  );
}
