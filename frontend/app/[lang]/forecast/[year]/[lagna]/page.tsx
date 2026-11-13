import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import styles from "@/components/changes/Changes.module.css";
import { PersonalYearly } from "@/components/yearly/PersonalYearly";
import { YearlyDetail } from "@/components/yearly/YearlyDetail";
import { YearlyGate } from "@/components/yearly/YearlyGate";
import { findLagna } from "@/lib/changes";
import { fill } from "@/lib/hadahan";
import { type Locale, hasLocale } from "@/lib/i18n";
import { RASHI } from "@/lib/rashi";
import { backendHeaders } from "@/lib/staging";
import { type Year, YEARS, hasYear, yearlyPath } from "@/lib/yearly";

import { getDictionary } from "../../../dictionaries";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

type Params = PageProps<"/[lang]/forecast/[year]/[lagna]">;

export function generateStaticParams() {
  return YEARS.flatMap((year) => RASHI.map((rashi) => ({ year: String(year), lagna: rashi.key })));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, year, lagna: key } = await params;
  const lagna = findLagna(key);
  if (!hasLocale(lang) || !hasYear(year) || !lagna) return {};
  const t = (await getDictionary(lang)).yearly;
  const values = { year, lagna: lagna[lang] };
  const title = fill(t.metaTitle, values);
  const description = fill(t.metaDescription, values);
  const path = `/forecast/${year}/${lagna.key}`;
  return {
    title,
    description,
    alternates: { canonical: `/${lang}${path}`, languages: { si: `/si${path}`, en: `/en${path}` } },
    openGraph: { title, description, images: [{ url: "/images/share-preview.jpg", width: 1200, height: 630 }] },
  };
}

/** The year for this lagna, so it is in the page a search engine reads. Null when the backend is away. */
async function loadYear(year: number, lagna: string, lang: Locale): Promise<Year | null> {
  try {
    const response = await fetch(`${BACKEND}${yearlyPath(year, lagna, lang)}`, {
      cache: "no-store",
      headers: backendHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? ((await response.json()) as Year) : null;
  } catch {
    return null;
  }
}

type DetailProps = {
  t: Dictionary["yearly"];
  names: Pick<Dictionary["changes"], "planet" | "house">;
  lang: Locale;
  year: number;
  lagna: string;
};

async function LoadedYear(props: DetailProps) {
  return <YearlyDetail {...props} initial={await loadYear(props.year, props.lagna, props.lang)} />;
}

export default async function YearLagnaPage({ params }: Params) {
  const { lang, year: yearParam, lagna: key } = await params;
  const lagna = findLagna(key);
  if (!hasLocale(lang) || !hasYear(yearParam) || !lagna) notFound();
  const year = Number(yearParam);
  const dict = await getDictionary(lang);
  const t = dict.yearly;
  const names = { planet: dict.changes.planet, house: dict.changes.house };

  return (
    <main id="main" className={`container ${styles.page}`}>
      <YearlyGate>
        <div className={`rise ${styles.head}`}>
          <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
          <h1 className={`display ${styles.title}`}>{fill(t.title, { year, lagna: lagna[lang] })}</h1>
          <p className="soft">{fill(t.lead, { year, lagna: lagna[lang] })}</p>
          <div className={styles.links}>
            <Link href={`/${lang}/forecast/${year}`}>{t.all}</Link>
            <Link href={`/${lang}/changes`}>{t.changesLink}</Link>
          </div>
        </div>
        {/* The year is asked for at request time, so it streams in behind this boundary. */}
        <Suspense fallback={<p className={styles.status}>{t.loading}</p>}>
          <LoadedYear t={t} names={names} lang={lang} year={year} lagna={lagna.key} />
        </Suspense>
        <div className={styles.note}>
          <p>{fill(t.rashiNote, { lagna: lagna[lang] })}</p>
          <p>{t.provisional}</p>
          <p>{t.method}</p>
        </div>
        <PersonalYearly t={t} names={names} hadahan={dict.hadahan} lang={lang} year={year} />
        <section className={styles.section} aria-labelledby="lagnas-title">
          <h2 id="lagnas-title" className={`display ${styles.sectionTitle}`}>
            {t.otherLagnas}
          </h2>
          <ul className={styles.lagnas}>
            {RASHI.map((rashi) => (
              <li key={rashi.key}>
                <Link
                  href={`/${lang}/forecast/${year}/${rashi.key}`}
                  className={rashi.key === lagna.key ? styles.lagnaCurrent : styles.lagna}
                  aria-current={rashi.key === lagna.key ? "page" : undefined}
                  data-lagna={rashi.key}
                >
                  <Image src={rashi.image} alt="" width={52} height={52} unoptimized={rashi.image.endsWith(".svg")} />
                  <span className={styles.lagnaName}>{rashi[lang]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </YearlyGate>
    </main>
  );
}
