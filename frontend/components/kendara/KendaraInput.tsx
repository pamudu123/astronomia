"use client";

import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { HOUSE_CENTRES, LINES, TRIANGLES } from "@/components/hadahan/Kendara";
import type { Labels } from "@/lib/hadahan";
import { BODIES, type BodyKey, type DrawingState, HOUSE_SHAPES, nextUnplaced, placedCount } from "@/lib/kendara";
import { RASHI } from "@/lib/rashi";

import styles from "./Kendara.module.css";

type Props = {
  id: string;
  title: string;
  t: Dictionary["kendara"]["form"];
  labels: Labels;
  drawing: DrawingState;
  disabled: boolean;
  onChange: (update: (current: DrawingState) => DrawingState) => void;
};

/**
 * A kendara to fill in, drawn like the paper: choose the lagna sign, then tap a planet and tap
 * its box. To move a planet, tap it again in the row above and tap its new box. The planets
 * drawn in the boxes do not take taps, so a box with a planet in it can still take another.
 */
export function KendaraInput({ id, title, t, labels, drawing, disabled, onChange }: Props) {
  const [selected, setSelected] = useState<BodyKey | null>("sun");
  const short = (body: BodyKey) => labels.planet[body]?.short ?? body;
  const name = (body: BodyKey) => labels.planet[body]?.name ?? body;

  function place(house: number) {
    if (disabled || !selected) return;
    const body = selected;
    onChange((current) => ({ ...current, houses: { ...current.houses, [body]: house } }));
    setSelected(nextUnplaced({ ...drawing.houses, [body]: house }, body));
  }

  const byHouse = new Map<number, BodyKey[]>();
  for (const body of BODIES) {
    const house = drawing.houses[body];
    if (house !== undefined) byHouse.set(house, [...(byHouse.get(house) ?? []), body]);
  }
  const lagnaName = drawing.lagna ? labels.rashi[drawing.lagna]?.name : "";

  return (
    <fieldset className={styles.card} disabled={disabled} data-drawing={id}>
      <legend className={styles.legend}>{title}</legend>

      <div className={styles.field}>
        <label htmlFor={`${id}-lagna`} className={styles.label}>
          {t.lagna}
        </label>
        <select
          id={`${id}-lagna`}
          className={styles.select}
          value={drawing.lagna}
          onChange={(event) => onChange((current) => ({ ...current, lagna: event.target.value }))}
        >
          <option value="">{t.choose}</option>
          {RASHI.map((rashi) => (
            <option key={rashi.key} value={rashi.key}>
              {labels.rashi[rashi.key]?.name ?? rashi.key}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.chips} role="group" aria-label={t.planets}>
        {BODIES.map((body) => {
          const placed = drawing.houses[body] !== undefined;
          return (
            <button
              key={body}
              type="button"
              className={selected === body ? styles.chipOn : placed ? styles.chipDone : styles.chip}
              aria-pressed={selected === body}
              aria-label={placed ? `${name(body)}: ${labels.house[(drawing.houses[body] ?? 1) - 1]}` : name(body)}
              onClick={() => setSelected(body)}
            >
              {short(body)}
            </button>
          );
        })}
      </div>
      <p className={styles.hint} aria-live="polite">
        {selected ? t.tapBox.replace("{planet}", name(selected)) : t.allPlaced}
      </p>

      <svg className={styles.board} viewBox="-4 -4 308 308" role="group" aria-label={title}>
        {Object.entries(HOUSE_SHAPES).map(([key, points]) => {
          const house = Number(key);
          const names = (byHouse.get(house) ?? []).map(name).join(", ");
          return (
            <polygon
              key={house}
              points={points}
              className={house === 1 ? styles.boxLagna : styles.box}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`${labels.house[house - 1]}${names ? `: ${names}` : ""}`}
              data-house={house}
              onClick={() => place(house)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  place(house);
                }
              }}
            />
          );
        })}
        <path d={LINES} className={styles.lines} />
        <text x="150" y="16" className={styles.lagnaMark}>
          {t.lagnaMark}
        </text>
        <text x="150" y="150" className={styles.centre}>
          {lagnaName || t.lagnaHere}
        </text>
        {[...byHouse.entries()].map(([house, list]) => {
          const [cx, cy] = HOUSE_CENTRES[house];
          const step = TRIANGLES.has(house) ? 15 : 19;
          const top = cy - ((list.length - 1) * step) / 2 + (house === 1 ? 8 : 0);
          return list.map((body, index) => (
            <text key={body} x={cx} y={top + index * step} className={styles.planet} data-placed={body}>
              {short(body)}
            </text>
          ));
        })}
      </svg>

      <div className={styles.row}>
        <span className={styles.small}>{t.placed.replace("{count}", String(placedCount(drawing)))}</span>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => {
            onChange(() => ({ lagna: "", houses: {} }));
            setSelected("sun");
          }}
        >
          {t.clear}
        </button>
      </div>
    </fieldset>
  );
}
