"use client";

import Link from "next/link";
import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { type StarTone, starTone } from "@/lib/dayAdvice";
import { fill, loadResult } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { NAKSHATRA } from "@/lib/nakshatra";
import type { Panchanga } from "@/lib/nakath";
import { useHydrated } from "@/lib/useHydrated";

import styles from "./Day.module.css";
import { partTime } from "./format";

type Props = { lang: Locale; t: Dictionary["nakath"]; day: string; shown: Panchanga };

const TONE: Record<StarTone, string> = { good: styles.good, moderate: styles.moderate };
// A mark as well as a colour, so the meaning never rests on colour alone.
const MARK: Record<StarTone, string> = { good: "M3 8.5 6.5 12 13 4.5", moderate: "M3 8h10" };

/** The day's star against one birth star: from the chart kept in this browser, or chosen here. */
export function DayForYou({ lang, t, day, shown }: Props) {
  const s = t.day.star;
  const hydrated = useHydrated();
  // null: the chart's own star. "": the list is open. A key: a star chosen from the list.
  const [picked, setPicked] = useState<string | null>(null);
  const saved = hydrated ? loadResult() : null;
  const star = picked ?? saved?.result.chart?.moon.nakshatra ?? "";
  const name = NAKSHATRA.find((item) => item.key === star)?.[lang];
  const person = picked === null && name ? saved?.name : "";

  return (
    <section className={styles.card} aria-labelledby="day-star-title" data-card="for-you">
      <h2 id="day-star-title" className={`display ${styles.cardTitle}`}>
        {person ? fill(s.titleNamed, { name: person }) : s.title}
      </h2>
      {name ? (
        <>
          <p className={styles.small}>{fill(s.yours, { star: name })}</p>
          <ul className={styles.stars}>
            {shown.nakatha.map((part, index) => {
              const tone = starTone(star, part.key);
              if (!tone) return null;
              return (
                <li key={`${part.key}-${index}`} className={styles.star} data-tone={tone}>
                  <span className={`${styles.badge} ${TONE[tone]}`}>
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                      <path d={MARK[tone]} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                    {s[tone]}
                  </span>
                  <span>{s[`${tone}Text`]}</span>
                  <span className={styles.small}>
                    {fill(s.dayStar, { star: part.name })} · {partTime(part, index, day, t, lang)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={styles.small}>{s.note}</p>
          <button type="button" className={styles.linkButton} onClick={() => setPicked("")}>
            {s.change}
          </button>
        </>
      ) : (
        <>
          <p>{s.lead}</p>
          <label className={styles.field}>
            <span>{s.pick}</span>
            <select className={styles.select} value="" disabled={!hydrated} onChange={(e) => setPicked(e.target.value)}>
              <option value="" disabled>
                {s.choose}
              </option>
              {NAKSHATRA.map((item) => (
                <option key={item.key} value={item.key}>
                  {item[lang]}
                </option>
              ))}
            </select>
          </label>
          <Link href={`/${lang}/hadahan`} className={styles.linkButton}>
            {s.unknown}
          </Link>
        </>
      )}
    </section>
  );
}
