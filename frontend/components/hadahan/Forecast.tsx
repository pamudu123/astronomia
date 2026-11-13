"use client";

import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import {
  type BirthRequest,
  type Forecast as ForecastData,
  type Labels,
  fetchForecast,
  fill,
} from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import { PlanetIcon } from "@/components/PlanetIcon";

import styles from "./Forecast.module.css";
import { Kendara } from "./Kendara";

type Props = {
  lang: Locale;
  t: Dictionary["hadahan"]["result"];
  labels: Labels;
  request: BirthRequest;
};

type PlanetMonth = ForecastData["planets"][number];

/** The month as a bar: one colour while the planet stays, a second from the day it moves. */
function MonthTrack({ planet, days, labels }: { planet: PlanetMonth; days: number; labels: Labels }) {
  const move = planet.moves[0];
  const before = move ? ((Number(move.date.slice(8, 10)) - 1) / days) * 100 : 100;
  return (
    <div className={styles.track} aria-hidden="true">
      <div className={styles.bar}>
        <span className={styles.barStay} style={{ width: `${before}%` }} />
        {move && <span className={styles.barMove} style={{ width: `${100 - before}%` }} />}
        {move && <i className={styles.marker} style={{ left: `${before}%` }} />}
      </div>
      <div className={styles.trackLabels}>
        <span>{labels.rashi[planet.sign].name}</span>
        {move && (
          <span className={styles.trackTo}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9h12M10 4l5 5-5 5" />
            </svg>
            {labels.rashi[move.to_sign].name}
          </span>
        )}
      </div>
    </div>
  );
}

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

  const days = Number(forecast.month.end.slice(8, 10));
  const movers = forecast.planets.filter((planet) => planet.moves.length > 0).map((p) => p.body);

  return (
    <section className={`rise ${styles.panel}`} aria-labelledby="forecast-title" data-card="forecast">
      <div className={styles.head}>
        <h2 id="forecast-title" className={`display ${styles.title}`}>
          {t.forecast}
        </h2>
        <span className={styles.month}>{forecast.month.title}</span>
      </div>
      <p className="soft">{t.forecastLead}</p>

      <div className={styles.body}>
        <figure className={styles.sky}>
          <Kendara
            planets={forecast.planets.map((planet) => ({
              body: planet.body,
              house: planet.house,
              navamsha_house: planet.house,
            }))}
            labels={labels}
            mode="rashi"
            title={t.forecastSky}
            subtitle={forecast.month.title}
            ariaLabel={t.forecastSkyLabel}
            lagnaMark={t.lagnaMark}
            highlight={movers}
          />
          <figcaption className={styles.small}>{t.forecastSkyNote}</figcaption>
        </figure>

        <ul className={styles.grid}>
          {forecast.planets.map((planet, index) => {
            const moves = planet.moves.length > 0;
            return (
              <li
                key={planet.body}
                className={`rise ${moves ? styles.cardMoves : styles.card}`}
                style={{ animationDelay: `${0.06 * index}s` }}
                data-planet={planet.body}
              >
                <div className={styles.cardHead}>
                  <PlanetIcon body={planet.body} />
                  <h3 className={styles.planet}>{labels.planet[planet.body].name}</h3>
                  <span className={moves ? styles.badgeGold : styles.badge}>
                    {moves ? t.forecastMoves : fill(t.forecastHouse, { house: labels.house[planet.house - 1] })}
                  </span>
                </div>
                <MonthTrack planet={planet} days={days} labels={labels} />
                <p>{planet.text}</p>
                {planet.moves.map((move) => (
                  <p key={move.date} className={styles.move}>
                    {move.text}
                  </p>
                ))}
                <p className={styles.small}>{planet.theme}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <p className={styles.small}>
        {t.forecastNote} {forecast.provisional && t.forecastProvisional}
      </p>
    </section>
  );
}
