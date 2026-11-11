"use client";

import { useState } from "react";

import { type Dasha, type Labels, fill, formatMonthYear, formatYear } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import styles from "./HadahanResult.module.css";

type Text = { dasha: string; dashaLead: string; dashaNow: string; dashaSub: string };

export function DashaTimeline({ dasha, labels, lang, t }: { dasha: Dasha; labels: Labels; lang: Locale; t: Text }) {
  const [main, sub] = dasha.current;
  const currentMain = dasha.periods.find((p) => main && p.start === main.start) ?? dasha.periods[0];
  const [open, setOpen] = useState(false);
  const name = (lord: string) => labels.planet[lord].name;
  const years = (start: string, end: string) =>
    (new Date(end).getTime() - new Date(start).getTime()) / (365.25 * 86400000);

  return (
    <section className={`rise ${styles.panel}`} aria-labelledby="dasha-title">
      <div className={styles.panelHead}>
        <h2 id="dasha-title" className={`display ${styles.panelTitle}`}>
          {t.dasha}
        </h2>
        <p className="soft">{t.dashaLead}</p>
      </div>
      <div className={styles.timelineScroll}>
        <ol className={styles.timeline}>
          {dasha.periods.map((period) => {
            const current = main && period.start === main.start;
            const past = new Date(period.end) < new Date(main?.start ?? 0);
            return (
              <li
                key={period.start}
                className={current ? styles.periodNow : past ? styles.periodPast : styles.period}
                style={{ flex: `${years(period.start, period.end)} 0 92px` }}
                aria-current={current ? "true" : undefined}
              >
                <span className={styles.periodLord}>{name(period.lord)}</span>
                <span className={styles.periodYears}>
                  {formatYear(period.start)} → {formatYear(period.end)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className={styles.timelineFoot}>
        {main && sub && <p className="soft">{fill(t.dashaNow, { main: name(main.lord), sub: name(sub.lord) })}</p>}
        <button type="button" className={styles.linkButton} aria-expanded={open} onClick={() => setOpen(!open)}>
          {fill(t.dashaSub, { main: name(currentMain.lord) })}
        </button>
      </div>
      {open && (
        <ul className={styles.subList}>
          {currentMain.sub?.map((period) => (
            <li key={period.start} className={sub && period.start === sub.start ? styles.subNow : styles.subItem}>
              <span>{name(period.lord)}</span>
              <span className="soft">
                {formatMonthYear(period.start, lang)} → {formatMonthYear(period.end, lang)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
