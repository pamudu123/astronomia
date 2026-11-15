import Link from "next/link";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { fill, formatMonthYear } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { type MonthDay, type MonthPanchanga, shiftMonth } from "@/lib/nakath";

import { ShareWithAssistant } from "@/components/assistant/PageContext";
import { monthContext } from "@/lib/assistant/pages";

import styles from "./Litha.module.css";

/** "November 2026" or "2026 නොවැම්බර්" for a "YYYY-MM" month. */
export function monthTitle(month: string, lang: Locale): string {
  if (lang === "si") return formatMonthYear(`${month}-01T00:00:00Z`, lang);
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, number - 1, 1)),
  );
}

const WEEK = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

type Props = {
  lang: Locale;
  t: Dictionary["litha"];
  month: string;
  /** Today in Sri Lanka, to mark it. */
  today: string;
  data: MonthPanchanga | null;
};

/** The litha: one month of nakath in a calendar (a list on phones). */
export function LithaCalendar({ lang, t, month, today, data }: Props) {
  const current = today.slice(0, 7);
  return (
    <>
      <nav className={styles.monthNav} aria-label={t.indexTitle}>
        <Link href={`/${lang}/litha/${shiftMonth(month, -1)}`} rel="prev">
          ← {t.previous}
        </Link>
        {month !== current && <Link href={`/${lang}/litha`}>{t.thisMonth}</Link>}
        <Link href={`/${lang}/litha/${shiftMonth(month, 1)}`} rel="next">
          {t.next} →
        </Link>
      </nav>

      {!data ? (
        <div className={styles.status} role="status">
          <p>{t.failed}</p>
          {/* A full page load, so the month is asked for again (the page is made per request). */}
          <a href={`/${lang}/litha/${month}`} className="btn btn-outline lift">
            {t.retry}
          </a>
        </div>
      ) : (
        <>
          <ShareWithAssistant context={monthContext(data, lang)} />
          <Grid lang={lang} t={t} data={data} today={today} />
        </>
      )}

      {data && (
        <div className={styles.notes}>
          <p>{data.poya_note}</p>
          <p>{[data.place.name, data.timezone_note].filter(Boolean).join(" · ")}</p>
          <Link href={`/${lang}/nakath`}>{t.dayLink} →</Link>
        </div>
      )}
    </>
  );
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
    <Link href={`/${lang}/nakath/${day.date}`} className={classes} data-day={day.date} aria-current={today ? "date" : undefined}>
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
