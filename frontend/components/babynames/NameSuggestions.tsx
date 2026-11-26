"use client";

import { useEffect, useRef, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { AiNotice, useAiAcknowledged } from "@/components/assistant/AiNotice";
import { useAssistantOn } from "@/components/assistant/PageContext";
import { type AiName, type GenderFilter, type LengthFilter, type Names, fetchAiNames, fetchNames } from "@/lib/babynames";
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

/** The AI search for the filters as they are: its names, and whether it is asking now. */
type AiSearch = { key: string; names: AiName[]; status: "loading" | "done" | "failed" };

/**
 * Real names that start with the chosen letters, with filters for letter, gender and length.
 * Where the AI is on, "Search with AI" adds more names for the same filters, tagged AI, at the top.
 */
export function NameSuggestions({ t, lang, letters, selected, initial = null }: Props) {
  const n = t.names;
  const [picked, setPicked] = useState<string[]>(selected);
  const [gender, setGender] = useState<GenderFilter>("any");
  const [length, setLength] = useState<LengthFilter>("any");
  const [fetched, setFetched] = useState<{ key: string; data: Names } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const aiOn = useAssistantOn();
  const acknowledged = useAiAcknowledged();
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [ai, setAi] = useState<AiSearch | null>(null);
  const aiRequest = useRef<AbortController | null>(null);
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
    return () => {
      controller.abort();
      setFailedKey(null); // the filters moved on: coming back to these asks again
    };
  }, [key, picked, gender, length, lang, useInitial]);

  // The answer to the filters as they are now, once it is here.
  const data = useInitial ? initial : fetched?.key === key ? fetched.data : null;
  const failed = data === null && failedKey === key;
  // While it loads, the last names stay on screen, marked as the earlier ones. A failed request
  // takes them away: they would never match the filters.
  const loading = picked.length > 0 && data === null && !failed;
  const last = loading ? (fetched?.data ?? initial) : null;

  const toggle = (letter: string) =>
    setPicked((current) =>
      current.includes(letter) ? current.filter((l) => l !== letter) : letters.filter((l) => l === letter || current.includes(l)),
    );
  const counts = new Map(data?.letters.map((c) => [c.letter, c.count]) ?? []);
  const shown = picked.length === 0 ? [] : ((data ?? last)?.names ?? []);
  // AI names belong to the filters they were asked for: a filter change puts them away.
  const aiNow = ai?.key === key ? ai : null;
  const aiNames = aiNow?.names ?? [];
  const aiBusy = aiNow?.status === "loading";

  // A search still running when the filters change, or the page closes, is dropped.
  useEffect(() => () => aiRequest.current?.abort(), [key]);

  function searchAi() {
    if (!data || aiBusy) return;
    setNoticeOpen(false);
    const before = aiNames;
    const controller = new AbortController();
    aiRequest.current = controller;
    setAi({ key, names: before, status: "loading" });
    // The names on screen, the AI's own included, so a second press brings new ones.
    const onScreen = [...before.map((name) => name.si), ...data.names.map((name) => name.si)];
    fetchAiNames(picked, gender, length, onScreen, controller.signal)
      .then((found) => setAi({ key, names: [...before, ...found], status: "done" }))
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") setAi({ key, names: before, status: "failed" });
      });
  }

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
      {picked.length > 0 && !failed && (
        <p className={styles.small} aria-live="polite">
          {data ? fill(n.count, { count: shown.length }) : n.loading}
        </p>
      )}
      {picked.length > 0 && data && shown.length === 0 && aiNames.length === 0 && <p className={styles.small}>{n.none}</p>}
      {aiOn && picked.length > 0 && data && (
        <div className={styles.aiSearch} data-ai-names>
          <button
            type="button"
            className={`btn btn-outline lift ${styles.aiButton}`}
            disabled={aiBusy}
            aria-expanded={noticeOpen && !acknowledged ? true : undefined}
            onClick={() => (acknowledged ? searchAi() : setNoticeOpen(true))}
          >
            <span aria-hidden="true">✦</span> {aiBusy ? n.aiSearching : aiNames.length > 0 ? n.aiMore : n.aiSearch}
          </button>
          {noticeOpen && !acknowledged && <AiNotice onAccept={searchAi} />}
          <p className={styles.small} aria-live="polite">
            {aiNow?.status === "failed" && n.aiFailed}
            {aiNow?.status === "done" && (aiNames.length > 0 ? fill(n.aiFound, { count: aiNames.length }) : n.aiNone)}
          </p>
        </div>
      )}
      {aiNames.length > 0 && <p className={styles.small}>{n.aiNote}</p>}
      {(shown.length > 0 || aiNames.length > 0) && (
        <ul className={loading ? `${styles.names} ${styles.namesBefore}` : styles.names} aria-busy={loading}>
          {aiNames.map((name) => {
            const meaning = lang === "si" ? name.meaning_si : name.meaning_en;
            const other = lang === "si" ? name.meaning_en : name.meaning_si;
            return (
              <li key={`ai-${name.si}`} className={`${styles.name} ${styles.nameAi}`} data-name={name.en} data-ai-name>
                <div className={styles.nameHead}>
                  <span className={styles.tagAi} title={n.aiTagTitle}>
                    <span aria-hidden="true">✦</span> {n.aiTag}
                  </span>
                  <span className={`sinhala ${styles.nameSi}`} lang="si">
                    {name.si}
                  </span>
                  <span className={styles.nameEn}>{name.en}</span>
                  <span className={styles.tagSoft}>{n.genders[name.gender as "boy" | "girl"] ?? n.both}</span>
                </div>
                {meaning && <p>{meaning}</p>}
                {other && (
                  <p className={styles.small}>{lang === "si" ? other : <span lang="si">{other}</span>}</p>
                )}
              </li>
            );
          })}
          {shown.map((name) => (
            <li key={name.en} className={styles.name} data-name={name.en}>
              <div className={styles.nameHead}>
                <span className={`sinhala ${styles.nameSi}`} lang="si">
                  {name.si}
                </span>
                <span className={styles.nameEn}>{name.en}</span>
                <span className={styles.tagSoft}>{n.genders[name.gender as "boy" | "girl"] ?? n.both}</span>
              </div>
              {/* Names whose meaning has no source come with an empty meaning: show none. */}
              {name.meaning && (
                <>
                  <p>{name.meaning}</p>
                  <p className={styles.small}>
                    {lang === "si" ? name.meaning_en : <span lang="si">{name.meaning_si}</span>}
                  </p>
                </>
              )}
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
