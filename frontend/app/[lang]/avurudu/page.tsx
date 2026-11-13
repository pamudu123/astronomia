import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/nakath/Nakath.module.css";
import { fill } from "@/lib/hadahan";
import { hasLocale } from "@/lib/i18n";
import { AVURUDU_YEARS, CITIES, FEATURED_YEAR } from "@/lib/nakath";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/avurudu">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).avurudu;
  return {
    title: t.metaIndexTitle,
    description: t.metaIndexDescription,
    alternates: { canonical: `/${lang}/avurudu`, languages: { si: "/si/avurudu", en: "/en/avurudu" } },
  };
}

/** Every year, and the next new year in each city's time. Needs no backend. */
export default async function AvuruduIndex({ params }: PageProps<"/[lang]/avurudu">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (await getDictionary(lang)).avurudu;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{t.indexTitle}</h1>
        <p className="soft">{t.indexLead}</p>
      </div>
      <section className={styles.section} aria-labelledby="featured-title">
        <h2 id="featured-title" className={`display ${styles.sectionTitle}`}>
          {t.featured}
        </h2>
        <Link href={`/${lang}/avurudu/${FEATURED_YEAR}`} className="btn btn-primary lift" style={{ alignSelf: "flex-start" }}>
          {fill(t.title, { year: FEATURED_YEAR })}
        </Link>
      </section>
      <section className={styles.section} aria-labelledby="cities-title">
        <h2 id="cities-title" className={`display ${styles.sectionTitle}`}>
          {t.cities}
        </h2>
        <ul className={styles.cities}>
          {CITIES.map((city) => (
            <li key={city.key}>
              <Link href={`/${lang}/avurudu/${FEATURED_YEAR}/${city.key}`} className={styles.chip} data-city={city.key}>
                {city[lang]}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.section} aria-labelledby="years-title">
        <h2 id="years-title" className={`display ${styles.sectionTitle}`}>
          {t.years}
        </h2>
        <ul className={styles.years}>
          {AVURUDU_YEARS.map((year) => (
            <li key={year}>
              <Link href={`/${lang}/avurudu/${year}`} className={year === FEATURED_YEAR ? styles.chipCurrent : styles.chip}>
                {year}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
