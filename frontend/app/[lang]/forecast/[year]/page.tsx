import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/changes/Changes.module.css";
import { YearlyGate } from "@/components/yearly/YearlyGate";
import { fill } from "@/lib/hadahan";
import { hasLocale } from "@/lib/i18n";
import { RASHI } from "@/lib/rashi";
import { YEARS, hasYear } from "@/lib/yearly";

import { getDictionary } from "../../dictionaries";

type Params = PageProps<"/[lang]/forecast/[year]">;

export function generateStaticParams() {
  return YEARS.map((year) => ({ year: String(year) }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, year } = await params;
  if (!hasLocale(lang) || !hasYear(year)) return {};
  const t = (await getDictionary(lang)).yearly;
  return {
    title: fill(t.metaIndexTitle, { year }),
    description: fill(t.metaIndexDescription, { year }),
    alternates: {
      canonical: `/${lang}/forecast/${year}`,
      languages: { si: `/si/forecast/${year}`, en: `/en/forecast/${year}` },
    },
  };
}

/** The twelve lagnas for one year. Needs no backend. */
export default async function YearIndexPage({ params }: Params) {
  const { lang, year } = await params;
  if (!hasLocale(lang) || !hasYear(year)) notFound();
  const t = (await getDictionary(lang)).yearly;

  return (
    <main id="main" className={`container ${styles.page}`}>
      <YearlyGate>
        <div className={`rise ${styles.head}`}>
          <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
          <h1 className={`display ${styles.title}`}>{fill(t.indexTitle, { year })}</h1>
          <p className="soft">{fill(t.indexLead, { year })}</p>
          <div className={styles.links}>
            <Link href={`/${lang}/changes`}>{t.changesLink}</Link>
          </div>
        </div>
        <ul className={styles.lagnas}>
          {RASHI.map((rashi) => (
            <li key={rashi.key}>
              <Link href={`/${lang}/forecast/${year}/${rashi.key}`} className={styles.lagna} data-lagna={rashi.key}>
                <Image src={rashi.image} alt="" width={52} height={52} unoptimized={rashi.image.endsWith(".svg")} />
                <span>
                  <span className={styles.lagnaName}>{rashi[lang]}</span>
                  <span className={styles.lagnaShift}>{fill(t.title, { year, lagna: rashi[lang] })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className={styles.note}>
          <p>{t.rashiNoteAll}</p>
          <p>{t.provisional}</p>
          <p>{t.method}</p>
        </div>
      </YearlyGate>
    </main>
  );
}
