"use client";

import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { PlaceSearch } from "@/components/hadahan/PlaceSearch";
import { type Place, fill, formatDate } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import type { PorondamRequest } from "@/lib/porondam";
import { CEREMONIES, type Ceremony, MONTHS, type Months, type Wedding, fetchWedding } from "@/lib/wedding";
import { useHydrated } from "@/lib/useHydrated";

import styles from "./Wedding.module.css";
import { WeddingGate } from "./WeddingGate";

type Props = {
  lang: Locale;
  t: Dictionary["porondam"]["wedding"];
  request: PorondamRequest;
};

/** "Wedding nakath for this couple", on the porondam result. Searches only when asked. */
export function WeddingFinder({ lang, t, request }: Props) {
  const hydrated = useHydrated();
  const [months, setMonths] = useState<Months>(6);
  const [chosen, setChosen] = useState<Ceremony[]>([...CEREMONIES]);
  const [place, setPlace] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Wedding | null>(null);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (chosen.length === 0) {
      setError(t.pickOne);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const found = await fetchWedding(request, { months, ceremonies: chosen, placeId: place?.id }, lang);
      if (found.status === "ok") setResult(found);
      else setError(t.clock);
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
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
          <>
            <p className={styles.small}>
              {fill(t.range_text, {
                first: formatDate(`${result.first}T00:00:00Z`, lang),
                last: formatDate(`${result.last}T00:00:00Z`, lang),
              })}{" "}
              {fill(t.zone, { zone: result.place.name ?? result.place.timezone, offset: result.place.offset })}
            </p>
            {result.ceremonies.map((ceremony) => (
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
            {result.note && <p className={styles.small}>{result.note}</p>}
            <p className={styles.small}>{t.provisional}</p>
          </>
        )}
      </section>
    </WeddingGate>
  );
}
