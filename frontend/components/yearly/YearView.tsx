import Link from "next/link";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { PlanetIcon } from "@/components/PlanetIcon";
import { findChange } from "@/lib/changes";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { type Year, dayOfYear, daysInYear } from "@/lib/yearly";

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

/** One year counted from one sign: a bar per planet, a month table and the key dates. */
export function YearView({ t, names, year, lang, id, heading }: Props) {
  const days = daysInYear(year.year);
  // First letters in English. Sinhala month names do not shorten well, so numbers.
  const short = (month: Year["months"][number]) => (lang === "en" ? month.name[0] : String(month.month));
  // Inside a personal view the parts sit under that view's own heading.
  const Title = heading ? "h4" : "h2";

  return (
    <div className={styles.section} data-year={id}>
      {heading && <h3 className={styles.sectionTitle}>{heading}</h3>}

      <section className={styles.section} aria-labelledby={`${id}-planets`}>
        <Title id={`${id}-planets`} className={`display ${styles.sectionTitle}`}>
          {t.planetsTitle}
        </Title>
        <ul className={styles.rows}>
          {year.planets.map((planet) => {
            const name = names.planet[planet.body as Body].name;
            return (
              <li key={planet.body} className={styles.row} data-planet={planet.body}>
                <div className={styles.rowHead}>
                  <PlanetIcon body={planet.body} size={28} />
                  <span className={styles.planet}>{name}</span>
                </div>
                <div className={styles.bar} role="img" aria-label={fill(t.barLabel, { planet: name })}>
                  {planet.stays.map((stay) => {
                    const from = dayOfYear(stay.start, year.year);
                    const to = dayOfYear(stay.end, year.year) + 1;
                    return (
                      <span
                        key={stay.start}
                        className={styles.segment}
                        style={{ width: `${((to - from) / days) * 100}%` }}
                        title={stay.text}
                      >
                        {names.house[stay.house - 1]}
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
                      {stay.text} <span className={styles.small}>{stay.theme}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby={`${id}-months`}>
        <Title id={`${id}-months`} className={`display ${styles.sectionTitle}`}>
          {t.monthsTitle}
        </Title>
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
                {change.moves.map((move) => (
                  <p key={move.body}>{move.text}</p>
                ))}
                {counted.moves.map((move) => (
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
    </div>
  );
}
