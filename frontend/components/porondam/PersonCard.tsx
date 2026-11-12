"use client";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { FormValues } from "@/components/hadahan/BirthForm";
import formStyles from "@/components/hadahan/BirthForm.module.css";
import { PlaceSearch } from "@/components/hadahan/PlaceSearch";
import type { Labels } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { NAKSHATRA } from "@/lib/nakshatra";
import type { QuickInput } from "@/lib/porondam";

import styles from "./Porondam.module.css";

export const NAKSHATRA_ORDER = NAKSHATRA.map((star) => star.key);

type Props = {
  role: "bride" | "groom";
  lang: Locale;
  mode: "full" | "quick";
  full: FormValues;
  quick: QuickInput;
  labels: Labels | null;
  t: Dictionary["porondam"]["form"];
  h: Dictionary["hadahan"]["form"];
  /** Updates are functions of the current values, so quick edits never overwrite each other. */
  onFull: (update: (current: FormValues) => FormValues) => void;
  onQuick: (update: (current: QuickInput) => QuickInput) => void;
};

export function PersonCard({ role, lang, mode, full, quick, labels, t, h, onFull, onQuick }: Props) {
  const id = (field: string) => `${role}-${field}`;
  const title = role === "bride" ? t.bride : t.groom;
  const setFull = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    onFull((current) => ({ ...current, [key]: value }));
  const setQuick = <K extends keyof QuickInput>(key: K, value: QuickInput[K]) =>
    onQuick((current) => ({ ...current, [key]: value }));

  return (
    <fieldset className={`rise ${styles.person} ${role === "bride" ? styles.bride : styles.groom}`}>
      <legend className={styles.legend}>{title}</legend>

      <div className={formStyles.field}>
        <label htmlFor={id("name")} className={formStyles.label}>
          {h.name}
        </label>
        <input
          id={id("name")}
          className={formStyles.input}
          autoComplete="off"
          maxLength={60}
          value={mode === "full" ? full.name : quick.name}
          onChange={(e) => (mode === "full" ? setFull("name", e.target.value) : setQuick("name", e.target.value))}
        />
      </div>

      {mode === "full" ? (
        <>
          <div className={formStyles.pair}>
            <div className={formStyles.field}>
              <label htmlFor={id("date")} className={formStyles.label}>
                {h.date}
              </label>
              <input
                id={id("date")}
                className={formStyles.input}
                type="date"
                min="1800-01-01"
                max="2200-12-31"
                value={full.date}
                onChange={(e) => setFull("date", e.target.value)}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor={id("time")} className={formStyles.label}>
                {h.time}
              </label>
              <input
                id={id("time")}
                className={formStyles.input}
                type="time"
                value={full.time}
                onChange={(e) => setFull("time", e.target.value)}
              />
            </div>
          </div>
          <PlaceSearch
            lang={lang}
            label={h.place}
            hint={h.placeHint}
            empty={h.noPlaces}
            value={full.place}
            onChange={(place) => setFull("place", place)}
          />
        </>
      ) : (
        <div className={formStyles.pair}>
          <div className={formStyles.field}>
            <label htmlFor={id("star")} className={formStyles.label}>
              {t.star}
            </label>
            <select
              id={id("star")}
              className={formStyles.input}
              value={quick.nakshatra}
              onChange={(e) => setQuick("nakshatra", e.target.value)}
            >
              <option value="">{t.choose}</option>
              {NAKSHATRA_ORDER.map((key) => (
                <option key={key} value={key}>
                  {labels?.nakshatra[key] ?? key}
                </option>
              ))}
            </select>
          </div>
          <div className={formStyles.field}>
            <label htmlFor={id("pada")} className={formStyles.label}>
              {t.pada}
            </label>
            <select
              id={id("pada")}
              className={formStyles.input}
              value={String(quick.pada)}
              onChange={(e) => setQuick("pada", Number(e.target.value))}
            >
              {[1, 2, 3, 4].map((pada) => (
                <option key={pada} value={pada}>
                  {pada}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </fieldset>
  );
}
