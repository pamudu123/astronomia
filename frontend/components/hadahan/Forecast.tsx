"use client";

import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { type BirthRequest, type Forecast as ForecastData, type Labels, fetchForecast, fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import styles from "./Forecast.module.css";

type Props = {
  lang: Locale;
  t: Dictionary["hadahan"]["result"];
  labels: Labels;
  request: BirthRequest;
};

/** "This month for you": where the slow planets are, counted from the lagna. */
export function Forecast({ lang, t, labels, request }: Props) {
  const [forecast, setForecast] = useState<ForecastData | null>(null);

  useEffect(() => {
    let current = true;
    fetchForecast(request, lang)
      .then((result) => {
        if (current && result.forecast) setForecast(result.forecast);
      })
      // The rest of the hadahan stands without this section.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [request, lang]);

  if (!forecast) return null;

  return (
    <section className={`rise ${styles.panel}`} aria-labelledby="forecast-title" data-card="forecast">
      <div className={styles.head}>
        <h2 id="forecast-title" className={`display ${styles.title}`}>
          {t.forecast}
        </h2>
        <span className={styles.month}>{forecast.month.title}</span>
      </div>
      <p className="soft">{t.forecastLead}</p>
      <ul className={styles.grid}>
        {forecast.planets.map((planet, index) => (
          <li
            key={planet.body}
            className={`rise ${planet.moves.length > 0 ? styles.cardMoves : styles.card}`}
            style={{ animationDelay: `${0.06 * index}s` }}
            data-planet={planet.body}
          >
            <div className={styles.cardHead}>
              <h3 className={styles.planet}>{labels.planet[planet.body].name}</h3>
              <span className={planet.moves.length > 0 ? styles.badgeGold : styles.badge}>
                {planet.moves.length > 0
                  ? t.forecastMoves
                  : fill(t.forecastHouse, { house: labels.house[planet.house - 1] })}
              </span>
            </div>
            <p>{planet.text}</p>
            {planet.moves.map((move) => (
              <p key={move.date} className={styles.move}>
                {move.text}
              </p>
            ))}
            <p className={styles.small}>{planet.theme}</p>
          </li>
        ))}
      </ul>
      <p className={styles.small}>
        {t.forecastNote} {forecast.provisional && t.forecastProvisional}
      </p>
    </section>
  );
}
