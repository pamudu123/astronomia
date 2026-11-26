"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { PlaceSearch } from "@/components/hadahan/PlaceSearch";
import type { Place } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { failureText } from "@/lib/request";
import { COLOMBO, type Panchanga, type PanchangaPart, type PlaceChoice, fetchPanchanga, hasNakathDay } from "@/lib/nakath";

import { AiExplain } from "@/components/assistant/Explain";
import { useAssistantContext } from "@/components/assistant/PageContext";
import { PAGE_PLACES } from "@/lib/assistant/explain";
import { dayContext } from "@/lib/assistant/pages";

import dayStyles from "./Day.module.css";
import { DayAnswer } from "./DayAnswer";
import { DayForYou } from "./DayForYou";
import { DayMoon } from "./DayMoon";
import styles from "./Nakath.module.css";
import { partTime } from "./format";

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

type PartsProps = { title: string; means: string; parts: PanchangaPart[]; day: string; t: Dictionary["nakath"]; lang: Locale };

function Parts({ title, means, parts, day, t, lang }: PartsProps) {
  return (
    <div className={styles.item} data-part={title}>
      <p className={styles.itemName}>{title}</p>
      <p className={styles.small}>{means}</p>
      <ul className={styles.parts}>
        {parts.map((part, index) => (
          <li key={`${part.key}-${index}`}>
            <strong>{part.name}</strong>
            <span className={styles.small}>{partTime(part, index, day, t, lang)}</span>
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
  // What the AI assistant sees: this result, with no birth details.
  const context = data ? dayContext(data, place, lang) : null;
  useAssistantContext(context);

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
      <div className={styles.links}>
        {hasNakathDay(shift(day, -1)) && <Link href={`/${lang}/nakath/${shift(day, -1)}`}>{t.previous}</Link>}
        {hasNakathDay(shift(day, 1)) && <Link href={`/${lang}/nakath/${shift(day, 1)}`}>{t.next}</Link>}
        <a href="#another-day">{t.day.another}</a>
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
          {shown.skipped ? (
            <p className={styles.note} role="status" data-skipped>
              {shown.skipped_note}
            </p>
          ) : (
            <DayDetails lang={lang} t={t} day={day} shown={shown} facts={context} />
          )}
        </>
      )}

      <form
        id="another-day"
        aria-label={t.day.another}
        className={`${styles.controls} ${styles.dayForm}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (picked) router.push(`/${lang}/nakath/${picked}`);
        }}
      >
        <div className={styles.control}>
          <PlaceSearch
            lang={lang}
            label={t.place}
            hint={t.placeHint}
            empty={t.noPlaces}
            value={place}
            onChange={setPlace}
            placeholder={shown?.place.name ?? undefined}
          />
        </div>
        <div className={styles.control}>
          <label htmlFor="nakath-date" className={styles.label}>
            {t.date}
          </label>
          <input id="nakath-date" className={styles.input} type="date" value={picked} onChange={(e) => setPicked(e.target.value)} />
        </div>
        <div className={styles.action}>
          <span className={styles.label} aria-hidden="true">
            &nbsp;
          </span>
          <button type="submit" className="btn btn-outline lift">
            {t.show}
          </button>
        </div>
      </form>
    </>
  );
}

type DetailsProps = Pick<Props, "lang" | "t" | "day"> & {
  shown: Panchanga;
  facts: ReturnType<typeof dayContext> | null;
};

function DayDetails({ lang, t, day, shown, facts }: DetailsProps) {
  return (
    <>
      <DayAnswer t={t} shown={shown} />
      <div className={dayStyles.pair}>
        <DayForYou lang={lang} t={t} day={day} shown={shown} />
        <DayMoon t={t} shown={shown} />
      </div>
      <AiExplain chapters={PAGE_PLACES.day} lang={lang} facts={facts} />
      <details className={dayStyles.almanac} data-card="almanac">
        <summary>{t.day.almanac}</summary>
        <div className={`${styles.day} ${dayStyles.almanacBody}`}>
          {(["thithi", "nakatha", "yoga", "karana"] as const).map((part) => (
            <Parts key={part} title={t[part]} means={t.day.means[part]} parts={shown[part]} day={day} t={t} lang={lang} />
          ))}
        </div>
      </details>
      <p className={styles.note}>{t.provisional}</p>
    </>
  );
}
