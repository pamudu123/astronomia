import Link from "next/link";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { formatMonthYear } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { type MonthPanchanga, shiftMonth } from "@/lib/nakath";

import styles from "./Litha.module.css";
import { LithaMonth } from "./LithaMonth";

/** "November 2026" or "2026 නොවැම්බර්" for a "YYYY-MM" month. */
export function monthTitle(month: string, lang: Locale): string {
  if (lang === "si") return formatMonthYear(`${month}-01T00:00:00Z`, lang);
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, number - 1, 1)),
  );
}

type Props = {
  lang: Locale;
  t: Dictionary["litha"];
  month: string;
  /** Today in Sri Lanka, to mark it. */
  today: string;
  /** From the server; null when the backend did not answer in time (the browser then asks). */
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
      {/* Keyed by month, so moving to another month starts from that month's server answer. */}
      <LithaMonth key={month} lang={lang} t={t} month={month} today={today} initial={data} />
    </>
  );
}
