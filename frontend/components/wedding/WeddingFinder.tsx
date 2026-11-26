"use client";

import { useEffect, useRef, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { PlaceSearch } from "@/components/hadahan/PlaceSearch";
import { type Place, fill, formatDate } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import type { PorondamRequest } from "@/lib/porondam";
import {
  CEREMONIES,
  type Ceremony,
  MONTHS,
  type Months,
  type Wedding,
  type WeddingChoice,
  dropFailedSearch,
  fetchWedding,
  keepSearch,
  loadSearch,
  matchKey,
  startSearch,
} from "@/lib/wedding";
import { failureText } from "@/lib/request";
import { useHydrated } from "@/lib/useHydrated";

import { useAssistantContext } from "@/components/assistant/PageContext";
import { weddingContext, weddingSearchContext } from "@/lib/assistant/pages";

import { SearchProgress } from "./SearchProgress";
import styles from "./Wedding.module.css";
import { WeddingGate } from "./WeddingGate";

type Props = {
  lang: Locale;
  t: Dictionary["porondam"]["wedding"];
  request: PorondamRequest;
};

/**
 * "Wedding nakath for this couple", on the porondam result. Searches only when asked. Its search
 * is kept for the tab: after a change of language the dates are still there, in the words they
 * were found in until the new ones arrive (QA-04).
 *
 * `onResult` tells the match page which dates were found, for the written reading; `explain`
 * is the AI explain button shown under them (docs/17, place 8), when the AI is on.
 */
export function WeddingFinder({
  lang,
  t,
  request,
  onResult,
  explain,
}: Props & { onResult?: (result: Wedding) => void; explain?: React.ReactNode }) {
  const hydrated = useHydrated();
  const match = matchKey(request);
  // Only ever drawn in the browser, once a match is on screen.
  const [saved] = useState(() => loadSearch(match));
  const [months, setMonths] = useState<Months>(saved?.months ?? 6);
  const [chosen, setChosen] = useState<Ceremony[]>(saved?.ceremonies ?? [...CEREMONIES]);
  const [place, setPlace] = useState<Place | null>(saved?.place ?? null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Wedding | null>(saved?.results[lang] ?? null);
  // The same dates in the other language, shown until this language's words arrive.
  const [other, setOther] = useState(() => {
    const found = Object.entries(saved?.results ?? {}).find(([language]) => language !== lang);
    return found ? { lang: found[0], found: found[1] } : null;
  });
  const [searching, setSearching] = useState<WeddingChoice | null>(saved && !saved.results[lang] ? saved : null);
  // What the last search looked for, when it did not finish.
  const [failed, setFailed] = useState<WeddingChoice | null>(null);
  const busy = searching !== null;
  const shown = result ?? other?.found ?? null;
  const translated = result !== null || other === null;
  // What the AI assistant sees: the search while it runs, or its result, with no birth details.
  const context = searching
    ? weddingSearchContext("running", searching, shown, lang, t.ceremony)
    : failed
      ? weddingSearchContext("failed", failed, shown, lang, t.ceremony)
      : result && weddingContext(result, lang);
  useAssistantContext(context, "wedding");

  function look(choice: WeddingChoice, from?: string) {
    return fetchWedding(request, { months: choice.months, ceremonies: choice.ceremonies, placeId: choice.place?.id, from }, lang)
      .then((found) => {
        if (found.status !== "ok") {
          dropFailedSearch(match);
          setError(t.clock);
          return;
        }
        keepSearch(match, choice, lang, found);
        setResult(found);
        onResult?.(found);
      })
      .catch((caught: unknown) => {
        dropFailedSearch(match);
        setFailed(choice);
        setError(failureText(caught, t));
      })
      .finally(() => setSearching(null));
  }

  // Once, as the match comes back on screen: hand over the kept dates, or find them again in
  // this language (or finish a search the change of language interrupted).
  const restored = useRef(false);
  useEffect(() => {
    if (!saved || restored.current) return;
    restored.current = true;
    const kept = saved.results[lang];
    if (kept) onResult?.(kept);
    else void look(saved, saved.first ?? undefined);
  });

  function search(event: React.FormEvent) {
    event.preventDefault();
    if (chosen.length === 0) {
      setError(t.pickOne);
      return;
    }
    const choice: WeddingChoice = { months, ceremonies: chosen, place };
    startSearch(match, choice);
    setSearching(choice);
    setOther(null);
    setFailed(null);
    setError(null);
    void look(choice);
  }

  const toggle = (ceremony: Ceremony) =>
    setChosen((current) =>
      current.includes(ceremony) ? current.filter((c) => c !== ceremony) : CEREMONIES.filter((c) => c === ceremony || current.includes(c)),
    );

  return (
    <WeddingGate>
      <section className={`rise ${styles.panel}`} aria-labelledby="wedding-title" data-card="wedding">
        <h2 id="wedding-title" className="display">
          {t.title}
        </h2>
        <p className="soft">{t.lead}</p>

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
          <fieldset className={`form-lock ${styles.group}`} disabled={!hydrated || busy}>
            <legend className={styles.legend}>{t.ceremonies}</legend>
            <div className={styles.options}>
              {CEREMONIES.map((ceremony) => (
                <label key={ceremony} className={styles.check}>
                  <input type="checkbox" checked={chosen.includes(ceremony)} onChange={() => toggle(ceremony)} />
                  {t.ceremony[ceremony]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className={`form-lock ${styles.group}`} disabled={!hydrated || busy}>
            <PlaceSearch lang={lang} label={t.place} hint={t.placeHint} empty={t.noPlaces} value={place} onChange={setPlace} />
          </fieldset>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <button type="submit" className={`btn btn-primary lift ${styles.submit}`} disabled={!hydrated || busy}>
            {busy ? t.working : t.find}
          </button>
          {searching && (
            <SearchProgress
              t={t.progress}
              range={t.months[String(searching.months) as keyof typeof t.months]}
              ceremonies={searching.ceremonies.map((ceremony) => t.ceremony[ceremony]).join(", ")}
            />
          )}
        </form>

        {shown?.place && shown.first && shown.last && (
          <div className={styles.results} lang={translated ? undefined : other?.lang} data-found>
            {!translated && (
              <p className={styles.small} lang={lang}>
                {busy ? t.translating : t.notTranslated}
              </p>
            )}
            <p className={styles.small} lang={lang}>
              {fill(t.range_text, {
                first: formatDate(`${shown.first}T00:00:00Z`, lang),
                last: formatDate(`${shown.last}T00:00:00Z`, lang),
              })}{" "}
              {fill(t.zone, { zone: shown.place.name ?? shown.place.timezone, offset: shown.place.offset })}
            </p>
            {shown.ceremonies.map((ceremony) => (
              <div key={ceremony.key} className={styles.ceremony} data-ceremony={ceremony.key}>
                <h3 className="display">{ceremony.name}</h3>
                {ceremony.none_text && <p className="soft">{ceremony.none_text}</p>}
                <ul className={styles.list}>
                  {ceremony.suggestions.map((item) => (
                    <li key={item.date} className={styles.card} data-date={item.date}>
                      <p className={styles.date}>
                        {item.date_text} · {item.weekday}
                      </p>
                      <p className={styles.time}>{fill(t.time, { start: item.start.clock, end: item.end.clock })}</p>
                      <p className={styles.small}>{fill(t.facts, { nakatha: item.nakatha, thithi: item.thithi, lagna: item.lagna })}</p>
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
              </div>
            ))}
            {shown.note && <p className={styles.small}>{shown.note}</p>}
            {result && explain}
          </div>
        )}
      </section>
    </WeddingGate>
  );
}
