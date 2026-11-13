"use client";

import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { ArrowRight, Lock } from "@/components/Icons";
import { PlaceSearch } from "@/components/hadahan/PlaceSearch";
import { type Labels, type Place, fetchLabels, fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import {
  type DrawingState,
  EMPTY_DRAWING,
  type KendaraMatch,
  type KendaraRequest,
  type KendaraResult,
  fetchKendara,
  toDrawing,
  windowLength,
} from "@/lib/kendara";
import { NAKSHATRA } from "@/lib/nakshatra";
import { useHydrated } from "@/lib/useHydrated";

import styles from "./Kendara.module.css";
import { KendaraInput } from "./KendaraInput";

type Props = { lang: Locale; dict: Dictionary };

type Facts = { yearFrom: string; yearTo: string; date: string; star: string; place: Place | null };
const NO_FACTS: Facts = { yearFrom: "", yearTo: "", date: "", star: "", place: null };

/** Old horoscopes: draw the paper kendara, and see the births that fit it. */
export function KendaraApp({ lang, dict }: Props) {
  const t = dict.kendara;
  const hydrated = useHydrated();
  const [labels, setLabels] = useState<Labels | null>(null);
  const [rashi, setRashi] = useState<DrawingState>(EMPTY_DRAWING);
  const [withNavamsha, setWithNavamsha] = useState(false);
  const [navamsha, setNavamsha] = useState<DrawingState>(EMPTY_DRAWING);
  const [facts, setFacts] = useState<Facts>(NO_FACTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<KendaraResult | null>(null);

  useEffect(() => {
    fetchLabels(lang)
      .then(setLabels)
      .catch(() => setError(t.errors.failed));
  }, [lang, t.errors.failed]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const drawing = toDrawing(rashi);
    if (!drawing) {
      setError(t.errors.lagna);
      return;
    }
    const nav = withNavamsha ? toDrawing(navamsha) : null;
    if (withNavamsha && !nav) {
      setError(t.errors.navamshaLagna);
      return;
    }
    const request: KendaraRequest = { rashi: drawing, navamsha: nav };
    if (facts.date) request.date = facts.date;
    else {
      if (facts.yearFrom) request.year_from = Number(facts.yearFrom);
      if (facts.yearTo) request.year_to = Number(facts.yearTo);
    }
    if (facts.star) request.nakshatra = facts.star;
    if (facts.place) request.place_id = facts.place.id;
    setBusy(true);
    setError(null);
    try {
      setResult(await fetchKendara(request, lang));
      window.scrollTo({ top: 0 });
    } catch {
      setError(t.errors.failed);
    } finally {
      setBusy(false);
    }
  }

  if (result && labels) {
    return <KendaraResults t={t} result={result} onAgain={() => setResult(null)} />;
  }

  const f = t.form;
  const locked = !hydrated || !labels;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{t.title}</h1>
        <p className="soft">{t.lead}</p>
      </div>

      <form onSubmit={submit} noValidate className={styles.form}>
        <div className={styles.charts}>
          {labels ? (
            <KendaraInput
              id="rashi"
              title={f.rashiTitle}
              t={f}
              labels={labels}
              drawing={rashi}
              disabled={locked}
              onChange={(update) => setRashi(update)}
            />
          ) : (
            <p className={styles.small}>{f.loading}</p>
          )}
          {labels && withNavamsha && (
            <KendaraInput
              id="navamsha"
              title={f.navamshaTitle}
              t={f}
              labels={labels}
              drawing={navamsha}
              disabled={locked}
              onChange={(update) => setNavamsha(update)}
            />
          )}
        </div>
        <div className={styles.row}>
          <button
            type="button"
            className="btn btn-outline lift"
            disabled={locked}
            aria-pressed={withNavamsha}
            onClick={() => setWithNavamsha((value) => !value)}
          >
            {withNavamsha ? f.removeNavamsha : f.addNavamsha}
          </button>
          <span className={styles.small}>{f.navamshaHint}</span>
        </div>

        <fieldset className={styles.card} disabled={locked}>
          <legend className={styles.legend}>{f.factsTitle}</legend>
          <p className={styles.small}>{f.factsLead}</p>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="year-from" className={styles.label}>
                {f.yearFrom}
              </label>
              <input
                id="year-from"
                className={styles.input}
                type="number"
                inputMode="numeric"
                min={1900}
                max={2100}
                value={facts.yearFrom}
                onChange={(e) => setFacts({ ...facts, yearFrom: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="year-to" className={styles.label}>
                {f.yearTo}
              </label>
              <input
                id="year-to"
                className={styles.input}
                type="number"
                inputMode="numeric"
                min={1900}
                max={2100}
                value={facts.yearTo}
                onChange={(e) => setFacts({ ...facts, yearTo: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="known-date" className={styles.label}>
                {f.date}
              </label>
              <input
                id="known-date"
                className={styles.input}
                type="date"
                min="1900-01-01"
                value={facts.date}
                onChange={(e) => setFacts({ ...facts, date: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="birth-star" className={styles.label}>
                {f.star}
              </label>
              <select
                id="birth-star"
                className={styles.select}
                value={facts.star}
                onChange={(e) => setFacts({ ...facts, star: e.target.value })}
              >
                <option value="">{f.notKnown}</option>
                {NAKSHATRA.map((star) => (
                  <option key={star.key} value={star.key}>
                    {star[lang]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <PlaceSearch
            lang={lang}
            label={f.place}
            hint={f.placeHint}
            empty={dict.hadahan.form.noPlaces}
            value={facts.place}
            onChange={(place) => setFacts({ ...facts, place })}
          />
        </fieldset>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.submitRow}>
          <p className={styles.small}>
            <Lock /> {f.privacy}
          </p>
          <button type="submit" className="btn btn-primary lift" disabled={busy || locked}>
            {busy ? f.working : f.submit}
            {!busy && <ArrowRight />}
          </button>
        </div>
      </form>
    </main>
  );
}

function KendaraResults({
  t,
  result,
  onAgain,
}: {
  t: Dictionary["kendara"];
  result: KendaraResult;
  onAgain: () => void;
}) {
  const r = t.results;
  const length = (match: KendaraMatch) => {
    const { unit, value } = windowLength(match.minutes);
    return fill(unit === "minutes" ? r.minutes : r.hours, { value });
  };
  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>
          {result.status === "impossible"
            ? r.impossibleTitle
            : fill(result.matches.length === 1 ? r.titleOne : r.title, { count: result.matches.length })}
        </h1>
        <p className="soft">
          {fill(r.where, {
            place: result.place.name ?? r.placeChosen,
            offset: result.place.offset,
            first: result.first.slice(0, 4),
            last: result.last.slice(0, 4),
          })}
        </p>
      </div>

      {result.problems.length > 0 && (
        <ul className={styles.problems} role="alert">
          {result.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {result.note && <p className={styles.note}>{result.note}</p>}

      <ol className={styles.matches}>
        {result.matches.map((match) => (
          <li key={match.start.utc} className={styles.match} data-match={match.grade}>
            <div className={styles.matchHead}>
              <h2 className={styles.when}>{match.text}</h2>
              <span className={match.grade === "exact" ? styles.pillExact : styles.pillNear}>
                {match.grade === "exact" ? r.exact : r.near}
              </span>
            </div>
            <p className={styles.small}>{fill(r.length, { length: length(match) })}</p>
            <ul className={styles.stars}>
              {match.stars.map((star) => (
                <li key={`${star.nakshatra}-${star.pada}-${star.start.utc}`}>
                  {fill(match.stars.length > 1 ? r.starUntil : r.star, {
                    star: star.name,
                    pada: star.pada,
                    until: star.end.clock,
                  })}
                </li>
              ))}
            </ul>
            {match.near_text && <p className={styles.nearText}>{match.near_text}</p>}
          </li>
        ))}
      </ol>

      <p className={styles.note}>{r.provisional}</p>
      <button type="button" className={`btn btn-outline lift ${styles.again}`} onClick={onAgain}>
        {r.again}
      </button>
    </main>
  );
}
