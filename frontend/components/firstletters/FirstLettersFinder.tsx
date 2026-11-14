"use client";

import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { BirthForm, EMPTY_FORM, type FormValues } from "@/components/hadahan/BirthForm";
import { PlaceSearch } from "@/components/hadahan/PlaceSearch";
import { type Child, type FirstLetters, MONTHS, type Months, fetchFirstLetters } from "@/lib/firstletters";
import { type Place, fill, formatDate, loadResult } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { NAKSHATRA } from "@/lib/nakshatra";
import { failureText } from "@/lib/request";
import { useHydrated } from "@/lib/useHydrated";

import styles from "./FirstLetters.module.css";
import { FirstLettersGate } from "./FirstLettersGate";

type Props = {
  lang: Locale;
  t: Dictionary["firstLetters"];
  hadahan: Dictionary["hadahan"];
};

/** Good dates and times for a child's first letters. Searches only when asked. */
export function FirstLettersFinder({ lang, t, hadahan }: Props) {
  const hydrated = useHydrated();
  const [mode, setMode] = useState<"full" | "star">("full");
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [child, setChild] = useState<Child | null>(null);
  const [childText, setChildText] = useState("");
  const [star, setStar] = useState(NAKSHATRA[0].key);
  const [pada, setPada] = useState(1);
  const [birthDate, setBirthDate] = useState("");
  const [months, setMonths] = useState<Months>(3);
  const [place, setPlace] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FirstLetters | null>(null);
  // A hadahan made earlier in this tab saves typing. Read only after hydration.
  const saved = hydrated ? loadResult() : null;

  function chosenChild(): Child | null {
    if (mode === "star") return { mode: "star", nakshatra: star, pada, birthDate: birthDate || undefined };
    return child;
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const found = chosenChild();
    if (!found) {
      setError(t.needChild);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const answer = await fetchFirstLetters(found, { months, placeId: place?.id }, lang);
      if (answer.status === "ok") setResult(answer);
      else setError(t.clock);
    } catch (caught) {
      setError(failureText(caught, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FirstLettersGate>
      <section className={styles.panel} aria-labelledby="child-title" data-card="first-letters-child">
        <h2 id="child-title" className="display">
          {t.childTitle}
        </h2>
        <div className={styles.options} role="group" aria-label={t.childTitle}>
          {(["full", "star"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={option === mode ? styles.optionOn : styles.option}
              aria-pressed={option === mode}
              onClick={() => setMode(option)}
            >
              {t.mode[option]}
            </button>
          ))}
        </div>

        {mode === "full" && child?.mode === "full" && (
          <div className={styles.child} data-child="full">
            <span>{childText}</span>
            <button type="button" className={styles.option} onClick={() => setChild(null)}>
              {t.change}
            </button>
          </div>
        )}
        {mode === "full" && !child && (
          <>
            {saved && (
              <div className={styles.options}>
                <button
                  type="button"
                  className="btn btn-outline lift"
                  onClick={() => {
                    setChild({ mode: "full", request: saved.request });
                    setChildText(saved.name ? fill(t.savedNamed, { name: saved.name }) : t.saved);
                  }}
                >
                  {saved.name ? fill(t.useSavedNamed, { name: saved.name }) : t.useSaved}
                </button>
              </div>
            )}
            <BirthForm
              lang={lang}
              t={hadahan}
              initial={form}
              busy={false}
              error={null}
              embedded={{ title: t.formTitle, lead: t.formLead, submit: t.useDetails, working: t.useDetails }}
              onSubmit={(request, values, placeText) => {
                setForm(values);
                setChild({ mode: "full", request });
                setChildText(fill(t.childSummary, { date: values.date, time: values.time, place: placeText }));
              }}
            />
          </>
        )}
        {mode === "star" && (
          <div className={styles.row}>
            <label>
              {t.star}
              <select className={styles.select} value={star} onChange={(e) => setStar(e.target.value)}>
                {NAKSHATRA.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item[lang]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.pada}
              <select className={styles.select} value={pada} onChange={(e) => setPada(Number(e.target.value))}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.birthDate}
              <input
                className={styles.select}
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </label>
          </div>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="first-letters-title" data-card="first-letters">
        <h2 id="first-letters-title" className="display">
          {t.searchTitle}
        </h2>
        <form className={styles.form} onSubmit={search} noValidate>
          <fieldset className={`form-lock ${styles.group}`} disabled={!hydrated || busy}>
            <legend className={styles.legend}>{t.range}</legend>
            <div className={styles.options}>
              {MONTHS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === months ? styles.optionOn : styles.option}
                  aria-pressed={option === months}
                  onClick={() => setMonths(option)}
                >
                  {t.months[String(option) as keyof typeof t.months]}
                </button>
              ))}
            </div>
          </fieldset>
          <PlaceSearch lang={lang} label={t.place} hint={t.placeHint} empty={t.noPlaces} value={place} onChange={setPlace} />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <button type="submit" className={`btn btn-primary lift ${styles.submit}`} disabled={!hydrated || busy}>
            {busy ? t.working : t.find}
          </button>
        </form>

        {result?.place && result.first && result.last && (
          <div className={styles.ceremony} data-card="first-letters-result">
            <p className={styles.small}>
              {result.child && fill(t.forChild, { star: result.child.star_name })}{" "}
              {fill(t.rangeText, {
                first: formatDate(`${result.first}T00:00:00Z`, lang),
                last: formatDate(`${result.last}T00:00:00Z`, lang),
              })}{" "}
              {fill(t.zone, { zone: result.place.name ?? result.place.timezone, offset: result.place.offset })}
            </p>
            {result.age_note && <p className={styles.small}>{result.age_note}</p>}
            {result.none_text && <p className="soft">{result.none_text}</p>}
            <ul className={styles.list}>
              {result.suggestions.map((item) => (
                <li key={item.date} className={styles.card} data-date={item.date}>
                  <p className={styles.date}>
                    {item.date_text} · {item.weekday}
                  </p>
                  <p className={styles.time}>{fill(t.time, { start: item.start.clock, end: item.end.clock })}</p>
                  <p className={styles.small}>
                    {fill(t.facts, { nakatha: item.nakatha, thithi: item.thithi, lagna: item.lagna, tara: item.tara })}
                  </p>
                  {item.age && <p className={styles.small}>{item.age}</p>}
                  {item.cautions.length > 0 && (
                    <>
                      <p className={styles.small}>{t.cautions}</p>
                      <ul className={styles.cautions}>
                        {item.cautions.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <details>
                    <summary>{t.why}</summary>
                    <ul className={styles.reasons}>
                      {item.passes.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
            {result.note && <p className={styles.small}>{result.note}</p>}
            <p className={styles.small}>{t.provisional}</p>
          </div>
        )}
      </section>
    </FirstLettersGate>
  );
}
