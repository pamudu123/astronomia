import Link from "next/link";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";
import { AVURUDU_YEARS, CITIES, FEATURED_YEAR } from "@/lib/nakath";

import styles from "./Nakath.module.css";

type Props = {
  lang: Locale;
  t: Dictionary["avurudu"];
  /** The year shown, marked as the current one. */
  year: number;
  /** On a city page: that city, marked as the current one. */
  city?: string;
};

/**
 * Pick another year in one tap, on the page itself, and open the city shortcuts when wanted.
 * Plain links, so they work before the page's script has loaded and search engines follow them.
 */
export function AvuruduYears({ lang, t, year, city }: Props) {
  return (
    <nav className={styles.picker} aria-label={t.yearLabel}>
      <span className={styles.pickerLabel}>{t.yearLabel}</span>
      <ul className={styles.years}>
        {AVURUDU_YEARS.map((each) => {
          const current = each === year && !city;
          return (
            <li key={each}>
              <Link
                href={`/${lang}/avurudu/${each}`}
                className={each === year ? styles.chipCurrent : styles.chip}
                aria-current={current ? "page" : undefined}
              >
                {each}
              </Link>
            </li>
          );
        })}
      </ul>
      <details className={styles.more} open={Boolean(city)}>
        <summary>{t.cities}</summary>
        <ul className={styles.cities}>
          {CITIES.map((each) => (
            <li key={each.key}>
              <Link
                href={`/${lang}/avurudu/${FEATURED_YEAR}/${each.key}`}
                className={each.key === city ? styles.chipCurrent : styles.chip}
                aria-current={each.key === city ? "page" : undefined}
                data-city={each.key}
              >
                {each[lang]}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
