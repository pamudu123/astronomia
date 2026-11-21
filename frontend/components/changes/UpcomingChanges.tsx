"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { PlanetIcon } from "@/components/PlanetIcon";
import { type Upcoming, fetchUpcomingChanges, findChange } from "@/lib/changes";
import { type BirthRequest, fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import styles from "./Changes.module.css";

type Props = {
  lang: Locale;
  t: Dictionary["hadahan"]["result"];
  request: BirthRequest;
};

/** How many changes show before "Show all". */
const FIRST = 2;

/**
 * "Planet changes": the next twelve months. Counted from the lagna, or from the Moon sign
 * (gochara) at a tap, with the nearest changes first and the rest a tap away.
 */
export function UpcomingChanges({ lang, t, request }: Props) {
  const [data, setData] = useState<Upcoming | null>(null);
  const [from, setFrom] = useState<"lagna" | "moon">("lagna");
  const [all, setAll] = useState(false);

  useEffect(() => {
    let current = true;
    fetchUpcomingChanges(request, lang)
      .then((result) => current && result.status === "ok" && setData(result))
      // The rest of the hadahan stands without this section.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [request, lang]);

  if (!data || data.changes.length === 0) return null;

  const shown = all ? data.changes : data.changes.slice(0, FIRST);

  return (
    <section className={`rise ${styles.panel}`} aria-labelledby="changes-title" data-card="changes">
      <div className={styles.panelHead}>
        <h3 id="changes-title" className={`display ${styles.panelTitle}`}>
          {t.changesTitle}
        </h3>
        <div role="group" aria-label={t.changesTitle} className={styles.view}>
          {(["lagna", "moon"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={from === value}
              className={from === value ? styles.viewOn : styles.viewOff}
              onClick={() => setFrom(value)}
            >
              {value === "lagna" ? t.changesLagna : t.changesMoon}
            </button>
          ))}
        </div>
      </div>
      <ul className={styles.upcoming}>
        {shown.map(({ change, lagna, gochara }) => (
          <li key={change.id} className={styles.card} data-change={change.id}>
            <div className={styles.cardHead}>
              {change.moves.map((move) => (
                <PlanetIcon key={move.body} body={move.body} size={28} />
              ))}
              <h4 className={styles.planet}>{change.title}</h4>
            </div>
            <p className={styles.small}>
              <time dateTime={change.moment}>{change.when}</time>
            </p>
            <div className={styles.counts}>
              {(from === "lagna" ? lagna : gochara).moves.map((move) => (
                <span key={move.body}>{move.short}</span>
              ))}
            </div>
            {findChange(change.id) && data.lagna && (
              <Link href={`/${lang}/changes/${change.id}/${data.lagna}`}>{t.changesOpen}</Link>
            )}
          </li>
        ))}
      </ul>
      {data.changes.length > FIRST && (
        <button type="button" className={styles.more} aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? t.changesFewer : fill(t.changesAll, { count: data.changes.length })}
        </button>
      )}
    </section>
  );
}
