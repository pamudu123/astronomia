import { type Kuja, type Labels, fill } from "@/lib/hadahan";

import styles from "./KujaDials.module.css";

type Props = {
  kuja: Kuja;
  labels: Labels;
  t: { kujaFrom: string; kujaHouse: string; kujaCounts: string; kujaNotCounts: string; kujaDialNote: string };
  compact?: boolean;
};

const CENTRE = 50;
const RING = 36;

/** House 1 is at the top and the houses run anticlockwise, like the kendara. */
function position(house: number): [number, number] {
  const angle = (-90 - (house - 1) * 30) * (Math.PI / 180);
  return [CENTRE + RING * Math.cos(angle), CENTRE + RING * Math.sin(angle)];
}

/**
 * One ring of twelve houses for each point Kuja dosha is counted from (the lagna, the Moon
 * and Venus). It shows at a glance which house Mars is in and whether that house counts.
 */
export function KujaDials({ kuja, labels, t, compact = false }: Props) {
  return (
    <div className={styles.wrap}>
      <ul className={compact ? styles.dialsCompact : styles.dials}>
        {kuja.points.map((point) => (
          <li key={point.point} className={styles.dial} data-kuja-point={point.point}>
            <svg viewBox="0 0 100 100" className={styles.ring} aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => {
                const house = index + 1;
                const [x, y] = position(house);
                const mars = house === point.house;
                const counts = kuja.houses.includes(house);
                const tone = mars ? (point.counts ? styles.marsCounts : styles.marsFree) : counts ? styles.counts : styles.house;
                return (
                  <g key={house} className={tone}>
                    <circle cx={x} cy={y} r={mars ? 8.500 : 7} />
                    <text x={x} y={y}>
                      {house}
                    </text>
                  </g>
                );
              })}
              <text x={CENTRE} y={CENTRE} className={styles.centre}>
                {labels.planet.mars.short}
              </text>
            </svg>
            <span className={styles.from}>{fill(t.kujaFrom, { point: labels.point[point.point] })}</span>
            <span className={point.counts ? styles.yes : styles.no}>
              {fill(t.kujaHouse, { house: labels.house[point.house - 1] })} ·{" "}
              {point.counts ? t.kujaCounts : t.kujaNotCounts}
            </span>
          </li>
        ))}
      </ul>
      {!compact && <p className={styles.note}>{t.kujaDialNote}</p>}
    </div>
  );
}
