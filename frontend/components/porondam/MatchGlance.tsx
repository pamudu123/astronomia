"use client";

import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { type Labels, fill } from "@/lib/hadahan";
import { type Factor, groupFactors, isCounted, ringSegments } from "@/lib/porondam";

import { Check } from "./Check";
import styles from "./MatchGlance.module.css";
import page from "./Porondam.module.css";

type Props = {
  factors: Factor[];
  labels: Labels;
  t: Dictionary["porondam"]["result"];
  passed: number;
  total: number;
  /** Called when a factor is picked, before the page jumps to its explanation. */
  onPick: () => void;
  /** Shown beside the ring: the count in words and the legend. */
  children?: React.ReactNode;
};

type State = "pass" | "fail" | "off";
const stateOf = (factor: Factor): State => (!isCounted(factor) ? "off" : factor.passed ? "pass" : "fail");

// The ring, in the SVG's own units.
const CENTRE = 60;
const OUTER = 57;
const INNER = 41;
const GROUP_GAP = 8;
const SEGMENT_GAP = 2.4;

const point = (radius: number, degrees: number) => {
  const angle = ((degrees - 90) * Math.PI) / 180;
  return `${(CENTRE + radius * Math.cos(angle)).toFixed(2)} ${(CENTRE + radius * Math.sin(angle)).toFixed(2)}`;
};

/** One ring segment from start to end, in degrees clockwise from the top. */
function arc(start: number, end: number): string {
  const large = end - start > 180 ? 1 : 0;
  return [
    `M${point(OUTER, start)}`,
    `A${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, end)}`,
    `L${point(INNER, end)}`,
    `A${INNER} ${INNER} 0 ${large} 0 ${point(INNER, start)}`,
    "Z",
  ].join(" ");
}

/**
 * The match at a glance: a ring with one segment per factor, grouped by life area, and every
 * factor by name under its group. The ring is a picture of the list, so screen readers get the
 * list alone. Rajju and Vedha are not here: the page shows them apart from the count.
 */
export function MatchGlance({ factors, labels, t, passed, total, onPick, children }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const groups = groupFactors(factors, labels.porondam_theme);
  const segments = ringSegments(
    groups.map((group) => group.factors.length),
    GROUP_GAP,
    SEGMENT_GAP,
  );
  const status = (state: State) => (state === "off" ? t.notCounted : state === "pass" ? t.agrees : t.notAgrees);
  const keyOf = (id: string) => id || "rest";

  let index = 0;
  const ring = groups.flatMap((group) =>
    group.factors.map((factor) => {
      const { start, end } = segments[index++];
      const state = stateOf(factor);
      const dim = active !== null && active !== keyOf(group.id);
      return (
        <a key={factor.id} href={`#factor-${factor.id}`} tabIndex={-1} onClick={onPick}>
          <path
            d={arc(start, end)}
            className={`${state === "off" ? styles.segOff : state === "pass" ? styles.segPass : styles.segFail} ${dim ? styles.dim : ""}`}
            data-segment={state}
          >
            <title>{`${labels.porondam_factor[factor.id]?.name ?? factor.id}: ${status(state)}`}</title>
          </path>
        </a>
      );
    }),
  );

  return (
    <div className={styles.glance}>
      <div className={styles.top}>
        <svg viewBox="0 0 120 120" className={styles.ring} aria-hidden="true" data-ring>
          {ring}
          <text x={CENTRE} y={CENTRE - 4} className={styles.ringCount}>
            {passed}
          </text>
          <text x={CENTRE} y={CENTRE + 15} className={styles.ringOf}>
            {fill(t.ringOf, { total })}
          </text>
        </svg>
        <div className={styles.side}>{children}</div>
      </div>

      <div className={styles.groups}>
        {groups.map((group) => {
          const key = keyOf(group.id);
          return (
            <div
              key={key}
              className={styles.group}
              data-theme={key}
              onMouseEnter={() => setActive(key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(key)}
              onBlur={() => setActive(null)}
            >
              {group.name && (
                <h3 className={styles.groupHead}>
                  <span>{group.name}</span>
                  <span className={styles.groupCount}>
                    {group.counted
                      ? fill(t.factorsCount, { passed: group.agree, total: group.counted })
                      : t.notCounted}
                  </span>
                </h3>
              )}
              <ul className={page.markers}>
                {group.factors.map((factor) => {
                  const state = stateOf(factor);
                  const name = labels.porondam_factor[factor.id]?.name ?? factor.id;
                  return (
                    <li key={factor.id} data-marker={state}>
                      <a
                        href={`#factor-${factor.id}`}
                        aria-label={`${name}: ${status(state)}`}
                        className={state === "off" ? page.markerOff : state === "pass" ? page.markerPass : page.markerFail}
                        onClick={onPick}
                      >
                        <span className={page.markerIcon} aria-hidden="true">
                          {state === "off" ? "–" : <Check ok={state === "pass"} />}
                        </span>
                        <span className={page.markerName}>{name}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      {groups.some((group) => group.name) && <p className={page.small}>{t.themesNote}</p>}
    </div>
  );
}
