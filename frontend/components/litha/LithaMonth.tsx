"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { COLOMBO, type MonthDay, type MonthPanchanga, fetchMonth } from "@/lib/nakath";

import { useAssistantContext } from "@/components/assistant/PageContext";
import { monthContext } from "@/lib/assistant/pages";

import styles from "./Litha.module.css";

/** The id of today's card, to jump to. */
const TODAY = "today";

const WEEK = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

type Props = {
  lang: Locale;
  t: Dictionary["litha"];
  month: string;
  /** Today in Sri Lanka, to mark it. */
  today: string;
  /** From the server, or null when its quick try timed out or failed. */
  initial: MonthPanchanga | null;
};

/**
 * The month's calendar and notes. The server tries the backend for a few seconds only, so the
 * page never hangs; a sleeping free-tier backend can take far longer to wake and work out a
 * month. When the server came back empty, the browser asks again with a long wait, and "Try
 * again" asks again in place, instead of reloading into the same short server try (QA APP-01).
 */
export function LithaMonth({ lang, t, month, today, initial }: Props) {
  const [data, setData] = useState<MonthPanchanga | null>(initial);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const current = data && `${data.year}-${String(data.month).padStart(2, "0")}` === month ? data : null;
  // What the AI assistant sees: the month on screen.
  useAssistantContext(current ? monthContext(current, lang) : null);

  useEffect(() => {
    if (current || failed) return;
    let stale = false;
    fetchMonth(month, COLOMBO, lang)
      .then((result) => !stale && setData(result))
      .catch(() => !stale && setFailed(true));
    return () => {
      stale = true;
    };
  }, [current, failed, month, lang, attempt]);

  if (!current) {
    return (
      <div className={styles.status} role="status">
        <p>{failed ? t.failed : t.loading}</p>
        {failed && (
          <button
            type="button"
            className="btn btn-outline lift"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            {t.retry}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <ToToday lang={lang} t={t} here={today.startsWith(month)} />
      <Grid lang={lang} t={t} data={current} today={today} />
      <div className={styles.notes}>
        <p>{current.poya_note}</p>
        <p>{[current.place.name, current.timezone_note].filter(Boolean).join(" · ")}</p>
        <Link href={`/${lang}/nakath`}>{t.dayLink} →</Link>
      </div>
    </>
  );
}

/**
 * On phones the month is a long list, so this goes straight to today: in this list, or in this
 * month's when another month is open (NAV-3).
 */
function ToToday({ lang, t, here }: { lang: Locale; t: Dictionary["litha"]; here: boolean }) {
  useEffect(() => {
    // Come from another month for today: the days are here only now, after the page opened.
    if (here && window.location.hash === `#${TODAY}`) showToday();
  }, [here]);
  if (!here) {
    return (
      <Link href={`/${lang}/litha#${TODAY}`} className={styles.toToday} data-to-today>
        {t.toToday}
      </Link>
    );
  }
  return (
    <button type="button" className={styles.toToday} onClick={showToday} data-to-today>
      {t.toToday}
    </button>
  );
}

function showToday() {
  const day = document.getElementById(TODAY);
  day?.scrollIntoView({ block: "center" });
  day?.focus({ preventScroll: true });
}

function Grid({ lang, t, data, today }: { lang: Locale; t: Dictionary["litha"]; data: MonthPanchanga; today: string }) {
  const names = new Map(data.days.map((day) => [day.weekday, day.weekday_name]));
  const lead = WEEK.indexOf(data.days[0]?.weekday ?? "sunday");
  return (
    <div className={styles.calendar}>
      {WEEK.map((weekday) => (
        <span key={weekday} className={styles.weekday} aria-hidden="true">
          {names.get(weekday)}
        </span>
      ))}
      {Array.from({ length: lead }, (_, index) => (
        <span key={`blank-${index}`} className={styles.blank} aria-hidden="true" />
      ))}
      {data.days.map((day) => (
        <Day key={day.date} lang={lang} t={t} day={day} today={day.date === today} />
      ))}
    </div>
  );
}

function Day({ lang, t, day, today }: { lang: Locale; t: Dictionary["litha"]; day: MonthDay; today: boolean }) {
  const classes = [styles.day, day.poya ? styles.poya : "", today ? styles.today : ""].filter(Boolean).join(" ");
  return (
    <Link
      id={today ? TODAY : undefined}
      href={`/${lang}/nakath/${day.date}`}
      className={classes}
      data-day={day.date}
      aria-current={today ? "date" : undefined}
    >
      <span className={styles.dayHead}>
        <span className={`mono ${styles.dayNumber}`}>{Number(day.date.slice(8))}</span>
        <span className={styles.dayName}>{day.weekday_name}</span>
        {today && <span className={styles.todayBadge}>{t.today}</span>}
        {day.poya && (
          <span className={styles.poyaBadge}>
            <MoonIcon />
            {t.poya}
          </span>
        )}
      </span>
      {day.nakatha && <span className={styles.star}>{day.nakatha.name}</span>}
      {day.thithi && <span className={styles.thithi}>{day.thithi.name}</span>}
      {day.rahu_kalaya && (
        <span className={styles.rahu}>
          {t.rahu} <span className="mono">{day.rahu_kalaya.start.clock}–{day.rahu_kalaya.end.clock}</span>
        </span>
      )}
      {day.full_moon && <span className={`mono ${styles.fullMoon}`}>{fill(t.fullMoon, { time: day.full_moon.clock })}</span>}
    </Link>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
      <circle cx="6" cy="6" r="5" fill="currentColor" />
    </svg>
  );
}
