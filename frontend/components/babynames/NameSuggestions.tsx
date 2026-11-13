"use client";

import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { type GenderFilter, type LengthFilter, type Names, fetchNames } from "@/lib/babynames";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import styles from "./BabyNames.module.css";

type Props = {
  t: Dictionary["babyNames"];
  lang: Locale;
  /** The letters offered as filters, in table order. */
  letters: string[];
  /** The letters picked at first. */
  selected: string[];
  /** From the server for the first view, or null. */
  initial?: Names | null;
};

const GENDERS: GenderFilter[] = ["any", "boy", "girl"];
const LENGTHS: LengthFilter[] = ["any", "short", "medium", "long"];

/** Real names that start with the chosen letters, with filters for letter, gender and length. */
export function NameSuggestions({ t, lang, letters, selected, initial = null }: Props) {
  const n = t.names;
  const [picked, setPicked] = useState<string[]>(selected);
  const [gender, setGender] = useState<GenderFilter>("any");
  const [length, setLength] = useState<LengthFilter>("any");
  const [fetched, setFetched] = useState<{ key: string; data: Names } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const key = JSON.stringify([picked, gender, length, lang]);
  // The server's answer covers the first view, so the browser asks only after a filter changes.
  const useInitial = initial !== null && picked.join() === selected.join() && gender === "any" && length === "any";

  useEffect(() => {
    if (picked.length === 0 || useInitial) return;
    const controller = new AbortController();
    fetchNames(picked, gender, length, lang, controller.signal)
      .then((answer) => setFetched({ key, data: answer }))
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") setFailedKey(key);
      });
    return () => controller.abort();
  }, [key, picked, gender, length, lang, useInitial]);

  // While a new answer loads, the last one stays on screen.
  const data = useInitial ? initial : (fetched?.data ?? null);
  const failed = failedKey === key && fetched?.key !== key;

  const toggle = (letter: string) =>
    setPicked((current) =>
      current.includes(letter) ? current.filter((l) => l !== letter) : letters.filter((l) => l === letter || current.includes(l)),
    );
  const counts = new Map(data?.letters.map((c) => [c.letter, c.count]) ?? []);
  const shown = picked.length === 0 ? [] : (data?.names ?? []);

  return (
    <section className={styles.panel} aria-labelledby="names-title" data-card="names">
      <h2 id="names-title" className={`display ${styles.sectionTitle}`}>
        {n.title}
      </h2>
      <p className="soft">{n.lead}</p>

      <div className={styles.filters}>
        <fieldset className={styles.filter}>
          <legend>{n.letters}</legend>
          <div className={styles.chips}>
            {letters.map((letter) => (
              <button
                key={letter}
                type="button"
                className={`${styles.chip} sinhala`}
                aria-pressed={picked.includes(letter)}
                data-letter-chip={letter}
                onClick={() => toggle(letter)}
              >
                <span lang="si">{letter}</span>
                {counts.has(letter) && picked.includes(letter) && <span className={styles.chipCount}>{counts.get(letter)}</span>}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.filter}>
          <legend>{n.gender}</legend>
          <div className={styles.chips}>
            {GENDERS.map((value) => (
              <button
                key={value}
                type="button"
                className={styles.chip}
                aria-pressed={gender === value}
                onClick={() => setGender(value)}
              >
                {n.genders[value]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.filter}>
          <legend>{n.length}</legend>
          <div className={styles.chips}>
            {LENGTHS.map((value) => (
              <button
                key={value}
                type="button"
                className={styles.chip}
                aria-pressed={length === value}
                onClick={() => setLength(value)}
              >
                {n.lengths[value]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {failed && (
        <p className={styles.small} role="alert">
          {t.failed}
        </p>
      )}
      {picked.length === 0 && <p className={styles.small}>{n.pickLetter}</p>}
      {picked.length > 0 && data && !failed && (
        <p className={styles.small} aria-live="polite">
          {fill(n.count, { count: shown.length })}
        </p>
      )}
      {picked.length > 0 && data && shown.length === 0 && !failed && <p className={styles.small}>{n.none}</p>}
      {shown.length > 0 && (
        <ul className={styles.names}>
          {shown.map((name) => (
            <li key={name.en} className={styles.name} data-name={name.en}>
              <div className={styles.nameHead}>
                <span className={`sinhala ${styles.nameSi}`} lang="si">
                  {name.si}
                </span>
                <span className={styles.nameEn}>{name.en}</span>
                <span className={styles.tagSoft}>{n.genders[name.gender as "boy" | "girl"] ?? n.both}</span>
              </div>
              <p>{name.meaning}</p>
              <p className={styles.small}>
                {lang === "si" ? name.meaning_en : <span lang="si">{name.meaning_si}</span>}
              </p>
              <a className={styles.source} href={name.url} target="_blank" rel="noopener noreferrer">
                {name.source === "wikipedia_name" ? n.sourceName : n.sourcePerson}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.small}>{n.note}</p>
    </section>
  );
}
