"use client";

import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { HOUSE_CENTRES, LINES, TRIANGLES } from "@/components/hadahan/Kendara";
import type { Labels } from "@/lib/hadahan";
import {
  BODIES,
  type BodyKey,
  type DrawingState,
  HOUSE_SHAPES,
  absentCount,
  nextUnplaced,
  placedCount,
} from "@/lib/kendara";
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
  /** For a kendara that can be taken away (the navamsha): a close button at the top and a
      remove button at the bottom, both with this label. */
  onRemove?: () => void;
  removeLabel?: string;
};

/**
 * A kendara to fill in, drawn like the paper: choose the lagna sign, then tap a planet and tap
 * its box. To move a planet, tap it again in the row above and tap its new box. The planets
 * drawn in the boxes do not take taps, so a box with a planet in it can still take another.
 * A planet the paper leaves out can be marked as not on this kendara; the search skips it.
 */
export function KendaraInput({ id, title, t, labels, drawing, disabled, onChange, onRemove, removeLabel }: Props) {
  const [selected, setSelected] = useState<BodyKey | null>("sun");
  const short = (body: BodyKey) => labels.planet[body]?.short ?? body;
  const name = (body: BodyKey) => labels.planet[body]?.name ?? body;

  function setHouse(house: number | null) {
    if (disabled || !selected) return;
    const body = selected;
    onChange((current) => ({ ...current, houses: { ...current.houses, [body]: house } }));
    setSelected(nextUnplaced({ ...drawing.houses, [body]: house }, body));
  }

  const byHouse = new Map<number, BodyKey[]>();
  for (const body of BODIES) {
    const house = drawing.houses[body];
    if (typeof house === "number") byHouse.set(house, [...(byHouse.get(house) ?? []), body]);
  }
  const lagnaName = drawing.lagna ? labels.rashi[drawing.lagna]?.name : "";
  const absent = absentCount(drawing);
  const selectedOff = selected !== null && drawing.houses[selected] === null;
  const hint = !selected
    ? absent > 0
      ? t.allDone
      : t.allPlaced
    : (selectedOff ? t.isOff : t.tapBox).replace("{planet}", name(selected));

  return (
    <fieldset className={styles.card} disabled={disabled} data-drawing={id}>
      <legend className={styles.legend}>{title}</legend>
      {onRemove && (
        <button type="button" className={styles.close} aria-label={removeLabel} title={removeLabel} onClick={onRemove}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}

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
          const house = drawing.houses[body];
          const off = house === null;
          return (
            <button
              key={body}
              type="button"
              className={
                selected === body
                  ? styles.chipOn
                  : off
                    ? styles.chipOff
                    : house !== undefined
                      ? styles.chipDone
                      : styles.chip
              }
              aria-pressed={selected === body}
              aria-label={
                off
                  ? t.offLabel.replace("{planet}", name(body))
                  : typeof house === "number"
                    ? `${name(body)}: ${labels.house[house - 1]}`
                    : name(body)
              }
              onClick={() => setSelected(body)}
            >
              {short(body)}
            </button>
          );
        })}
      </div>
      <div className={styles.hintRow}>
        <p className={styles.hint} aria-live="polite">
          {hint}
        </p>
        {selected && !selectedOff && (
          <button type="button" className={styles.linkButton} onClick={() => setHouse(null)}>
            {t.notOnChart.replace("{planet}", name(selected))}
          </button>
        )}
      </div>

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
              onClick={() => setHouse(house)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setHouse(house);
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
        <span className={styles.small}>
          {(absent > 0 ? t.placedSome : t.placed)
            .replace("{count}", String(placedCount(drawing)))
            .replace("{absent}", String(absent))}
        </span>
        <span className={styles.rowActions}>
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
          {onRemove && (
            <button type="button" className={styles.linkButton} onClick={onRemove}>
              {removeLabel}
            </button>
          )}
        </span>
      </div>
    </fieldset>
  );
}
