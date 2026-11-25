import Link from "next/link";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { PlanetIcon } from "@/components/PlanetIcon";
import { Spot } from "@/components/Spot";
import { findChange } from "@/lib/changes";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { AREA_SPOTS, type Year, areasOf, dayOfYear, daysInYear } from "@/lib/yearly";

import styles from "./Yearly.module.css";

type Props = {
  t: Dictionary["yearly"];
  /** Planet names and house ordinals. */
  names: Pick<Dictionary["changes"], "planet" | "house">;
  year: Year;
  lang: Locale;
  /** Tells the views apart when two share a page. */
  id: string;
  heading?: string;
};

type Body = keyof Dictionary["changes"]["planet"];

/**
 * One year counted from one sign, the meaning first: the parts of life the slow planets visit,
 * then when, then the key dates. Signs, houses and the month table are there to open.
 * Gold marks a part of life no slow planet was in when the year began. It says nothing about good
 * or bad, which the site has no confirmed rules for.
 */
export function YearView({ t, names, year, lang, id, heading }: Props) {
  const days = daysInYear(year.year);
  const areas = areasOf(year);
  const newHouses = new Set(areas.filter((item) => item.isNew).map((item) => item.house));
  // First letters in English. Sinhala month names do not shorten well, so numbers.
  const short = (month: Year["months"][number]) => (lang === "en" ? month.name[0] : String(month.month));
  // "3 June", or "ජූනි 3".
  const dayName = (date: string) => {
    const month = year.months[Number(date.slice(5, 7)) - 1].name;
    const day = Number(date.slice(8));
    return lang === "en" ? `${day} ${month}` : `${month} ${day}`;
  };
  const span = (stay: Year["planets"][number]["stays"][number]) =>
    stay.from_before && stay.past_end
      ? t.allYear
      : fill(stay.from_before ? t.untilDay : stay.past_end ? t.fromDay : t.betweenDays, {
          from: dayName(stay.start),
          to: dayName(stay.end),
        });
  const planetName = (body: string) => names.planet[body as Body].name;
  const area = (house: number) => t.areas[house - 1];
  // Inside a personal view the parts sit under that view's own heading.
  const Title = heading ? "h4" : "h2";

  return (
    <div className={styles.section} data-year={id}>
      {heading && <h3 className={styles.sectionTitle}>{heading}</h3>}

      <section className={styles.section} aria-labelledby={`${id}-areas`}>
        <Title id={`${id}-areas`} className={`display ${styles.sectionTitle}`}>
          {t.areasTitle}
        </Title>
        <p className={styles.small}>{t.areasLead}</p>
        <ul className={styles.areas}>
          {areas.map(({ house, visits, isNew }) => (
            <li key={house} className={isNew ? styles.areaNew : styles.area} data-area={house}>
              <Spot name={AREA_SPOTS[house - 1]} className={styles.spot} />
              <div className={styles.areaText}>
                <p className={styles.planet}>{area(house)}</p>
                {isNew && <p className={styles.newBadge}>{t.newArea}</p>}
                <ul className={styles.visits}>
                  {visits.map(({ body, stay }) => (
                    <li key={`${body}-${stay.start}`}>
                      <strong>{planetName(body)}</strong> {span(stay)}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby={`${id}-planets`}>
        <Title id={`${id}-planets`} className={`display ${styles.sectionTitle}`}>
          {t.planetsTitle}
        </Title>
        <p className={styles.legend}>
          <span>
            <i className={styles.swatchNew} aria-hidden="true" /> {t.newArea}
          </span>
          <span>
            <i className={styles.swatchStay} aria-hidden="true" /> {t.sameArea}
          </span>
        </p>
        <ul className={styles.rows}>
          {year.planets.map((planet) => {
            const name = planetName(planet.body);
            return (
              <li key={planet.body} className={styles.row} data-planet={planet.body}>
                <div className={styles.rowHead}>
                  <PlanetIcon body={planet.body} size={28} />
                  <span className={styles.planet}>{name}</span>
                  <span className={styles.small}>{t.role[planet.body as Body]}</span>
                </div>
                <div className={styles.bar} role="img" aria-label={fill(t.barLabel, { planet: name })}>
                  {planet.stays.map((stay) => {
                    const from = dayOfYear(stay.start, year.year);
                    const to = dayOfYear(stay.end, year.year) + 1;
                    return (
                      <span
                        key={stay.start}
                        className={newHouses.has(stay.house) ? styles.segmentNew : styles.segment}
                        style={{ width: `${((to - from) / days) * 100}%` }}
                        title={`${area(stay.house)}: ${span(stay)}`}
                      >
                        <span>{area(stay.house)}</span>
                      </span>
                    );
                  })}
                </div>
                <div className={styles.ticks} aria-hidden="true">
                  {year.months.map((month) => (
                    <span key={month.month}>{short(month)}</span>
                  ))}
                </div>
                <ul className={styles.stays}>
                  {planet.stays.map((stay) => (
                    <li key={stay.start}>
                      {area(stay.house)} <span className={styles.small}>{span(stay)}</span>
                    </li>
                  ))}
                </ul>
                <details className={styles.more}>
                  <summary>{t.signsAndHouses}</summary>
                  <ul className={styles.stays}>
                    {planet.stays.map((stay) => (
                      <li key={stay.start}>
                        {stay.text} <span className={styles.small}>{stay.theme}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      {year.key_dates.length > 0 && (
        <section className={styles.section} aria-labelledby={`${id}-keys`}>
          <Title id={`${id}-keys`} className={`display ${styles.sectionTitle}`}>
            {t.keyTitle}
          </Title>
          <ul className={styles.keys}>
            {year.key_dates.map(({ change, counted }) => (
              <li key={change.id} className={styles.key} data-change={change.id}>
                <p className={styles.when}>
                  <time dateTime={change.moment}>{change.when}</time>
                </p>
                {counted.moves.map((move) => (
                  <p key={move.body}>
                    <strong>{planetName(move.body)}</strong>: {fill(t.moves, { from: area(move.from_house), to: area(move.to_house) })}
                  </p>
                ))}
                {change.moves.map((move) => (
                  <p key={move.body} className={styles.small}>
                    {move.text}
                  </p>
                ))}
                {counted.notes.length > 0 && (
                  <ul className={styles.notes}>
                    {counted.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                )}
                {findChange(change.id) && (
                  <Link href={`/${lang}/changes/${change.id}/${year.sign}`}>{t.open}</Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className={styles.more} data-card="months">
        <summary>{t.monthsMore}</summary>
        <p className={styles.small}>{t.monthsLead}</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.month}</th>
                {year.planets.map((planet) => (
                  <th key={planet.body} scope="col">
                    {names.planet[planet.body as Body].short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {year.months.map((month) => (
                <tr key={month.month} className={month.changes.length ? styles.changed : undefined}>
                  <th scope="row">
                    {month.name}
                    {month.changes.length > 0 && <i className={styles.dot} role="img" aria-label={t.changeMark} />}
                  </th>
                  {year.planets.map((planet) => (
                    <td key={planet.body}>{month.houses[planet.body]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
