"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { PlaceSearch } from "@/components/hadahan/PlaceSearch";
import { type Place, fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { failureText } from "@/lib/request";
import { COLOMBO, type Panchanga, type PanchangaPart, type PlaceChoice, fetchPanchanga } from "@/lib/nakath";

import styles from "./Nakath.module.css";
import { localDate } from "./format";

type Props = {
  lang: Locale;
  t: Dictionary["nakath"];
  day: string;
  /** From the server for Colombo, when it could reach the backend. */
  initial: Panchanga | null;
};

const shift = (day: string, days: number) => {
  const moment = new Date(`${day}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
};

function Parts({ title, parts, day, t, lang }: { title: string; parts: PanchangaPart[]; day: string; t: Dictionary["nakath"]; lang: Locale }) {
  const at = (time: PanchangaPart["end"], one: string, other: string) =>
    time.date === day ? fill(one, { time: time.clock }) : fill(other, { time: time.clock, date: localDate(time, lang) });
  return (
    <div className={styles.item} data-part={title}>
      <p className={styles.itemName}>{title}</p>
      <ul className={styles.parts}>
        {parts.map((part, index) => (
          <li key={`${part.key}-${index}`}>
            <strong>{part.name}</strong>
            <span className={styles.small}>
              {index === 0 ? at(part.end, t.until, t.untilDay) : `${at(part.start, t.from, t.fromDay)}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DailyView({ lang, t, day, initial }: Props) {
  const router = useRouter();
  const [place, setPlace] = useState<Place | null>(null);
  const [data, setData] = useState<Panchanga | null>(initial);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState(day);

  const choice: PlaceChoice = { placeId: place?.id ?? COLOMBO };
  const current = data && data.date === day && data.place.id === choice.placeId && data ? data : null;

  useEffect(() => {
    if (current) return;
    let stale = false;
    fetchPanchanga(day, choice, lang)
      .then((result) => !stale && setData(result))
      .catch((caught) => !stale && setFailed(failureText(caught, t)));
    return () => {
      stale = true;
    };
    // choice is rebuilt each render; its id is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, day, choice.placeId, lang, attempt]);

  const shown = current ?? data;

  return (
    <>
      <form
        className={styles.controls}
        onSubmit={(event) => {
          event.preventDefault();
          if (picked) router.push(`/${lang}/nakath/${picked}`);
        }}
      >
        <div className={styles.control}>
          <PlaceSearch lang={lang} label={t.place} hint={t.placeHint} empty={t.noPlaces} value={place} onChange={setPlace} />
        </div>
        <div className={styles.control}>
          <label htmlFor="nakath-date" className={styles.label}>
            {t.date}
          </label>
          <input id="nakath-date" className={styles.input} type="date" value={picked} onChange={(e) => setPicked(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-outline lift">
          {t.show}
        </button>
      </form>

      <div className={styles.links}>
        <Link href={`/${lang}/nakath/${shift(day, -1)}`}>{t.previous}</Link>
        <Link href={`/${lang}/nakath/${shift(day, 1)}`}>{t.next}</Link>
      </div>

      {!shown ? (
        <div className={styles.status} role="status">
          <p>{failed ?? t.loading}</p>
          {failed && (
            <button
              type="button"
              className="btn btn-outline lift"
              onClick={() => {
                setFailed(null);
                setAttempt((n) => n + 1);
              }}
            >
              {t.retry}
            </button>
          )}
        </div>
      ) : (
        <>
          <p className={styles.small} data-card="where">
            {[shown.place.name, shown.weekday_name, shown.timezone_note].filter(Boolean).join(" · ")}
          </p>
          <div className={styles.day}>
            <div className={styles.item} data-card="sun">
              <p className={styles.itemName}>
                {t.sunrise} · {t.sunset}
              </p>
              {shown.sunrise && shown.sunset ? (
                <p className={styles.clock}>
                  {shown.sunrise.clock} · {shown.sunset.clock}
                </p>
              ) : (
                <p>{t.noSunrise}</p>
              )}
            </div>
            <div className={styles.itemKey} data-card="rahu">
              <p className={styles.itemName}>{t.rahu}</p>
              {shown.rahu_kalaya ? (
                <p className={styles.clock}>
                  {shown.rahu_kalaya.start.clock} · {shown.rahu_kalaya.end.clock}
                </p>
              ) : (
                <p>{t.noSunrise}</p>
              )}
              <p className={styles.small}>{t.rahuNote}</p>
            </div>
            <Parts title={t.thithi} parts={shown.thithi} day={day} t={t} lang={lang} />
            <Parts title={t.nakatha} parts={shown.nakatha} day={day} t={t} lang={lang} />
            <Parts title={t.yoga} parts={shown.yoga} day={day} t={t} lang={lang} />
            <Parts title={t.karana} parts={shown.karana} day={day} t={t} lang={lang} />
          </div>
          <p className={styles.note}>{t.provisional}</p>
        </>
      )}
    </>
  );
}
