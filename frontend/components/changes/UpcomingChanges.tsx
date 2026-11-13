"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { PlanetIcon } from "@/components/PlanetIcon";
import { type Upcoming, fetchUpcomingChanges, findChange } from "@/lib/changes";
import type { BirthRequest } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import styles from "./Changes.module.css";

type Props = {
  lang: Locale;
  t: Dictionary["hadahan"]["result"];
  request: BirthRequest;
};

/** "Planet changes for you": the next twelve months, from the lagna and the Moon sign. */
export function UpcomingChanges({ lang, t, request }: Props) {
  const [data, setData] = useState<Upcoming | null>(null);

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

  return (
    <section className={`rise ${styles.panel}`} aria-labelledby="changes-title" data-card="changes">
      <h2 id="changes-title" className="display">
        {t.changesTitle}
      </h2>
      <p className="soft">{t.changesLead}</p>
      <ul className={styles.upcoming}>
        {data.changes.map(({ change, lagna, gochara }) => (
          <li key={change.id} className={styles.card} data-change={change.id}>
            <div className={styles.cardHead}>
              {change.moves.map((move) => (
                <PlanetIcon key={move.body} body={move.body} size={28} />
              ))}
              <h3 className={styles.planet}>{change.title}</h3>
            </div>
            <p className={styles.small}>
              <time dateTime={change.moment}>{change.when}</time>
            </p>
            <div className={styles.counts}>
              <strong>{t.changesLagna}</strong>
              {lagna.moves.map((move) => (
                <span key={move.body}>{move.short}</span>
              ))}
            </div>
            <div className={styles.counts}>
              <strong>{t.changesMoon}</strong>
              {gochara.moves.map((move) => (
                <span key={move.body}>{move.short}</span>
              ))}
            </div>
            {findChange(change.id) && data.lagna && (
              <Link href={`/${lang}/changes/${change.id}/${data.lagna}`}>{t.changesOpen}</Link>
            )}
          </li>
        ))}
      </ul>
      <p className={styles.small}>{t.changesNote}</p>
    </section>
  );
}
