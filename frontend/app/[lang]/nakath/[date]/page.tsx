import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DailyView } from "@/components/nakath/DailyView";
import styles from "@/components/nakath/Nakath.module.css";
import { dayText } from "@/components/nakath/format";
import { backendJson } from "@/lib/backend";
import { fill } from "@/lib/hadahan";
import { type Locale, hasLocale } from "@/lib/i18n";
import { COLOMBO, FEATURED_YEAR, type Panchanga, isIsoDate, panchangaPath } from "@/lib/nakath";

import { getDictionary } from "../../dictionaries";

type Params = PageProps<"/[lang]/nakath/[date]">;

/** One date is built ahead (the next new year's day); every other date is made on request. */
export function generateStaticParams() {
  return [{ date: `${FEATURED_YEAR}-04-14` }];
}

const valid = (value: string) => isIsoDate(value) && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 2100;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, date } = await params;
  if (!hasLocale(lang) || !valid(date)) return {};
  const t = (await getDictionary(lang)).nakath;
  const values = { date: dayText(date, lang) };
  return {
    title: fill(t.metaDateTitle, values),
    description: fill(t.metaDateDescription, values),
    alternates: { canonical: `/${lang}/nakath/${date}`, languages: { si: `/si/nakath/${date}`, en: `/en/nakath/${date}` } },
  };
}

async function Loaded({ lang, t, day }: { lang: Locale; t: Awaited<ReturnType<typeof getDictionary>>["nakath"]; day: string }) {
  const initial = await backendJson<Panchanga>(panchangaPath(day, { placeId: COLOMBO }, lang));
  return <DailyView lang={lang} t={t} day={day} initial={initial} />;
}

export default async function DatePage({ params }: Params) {
  const { lang, date } = await params;
  if (!hasLocale(lang) || !valid(date)) notFound();
  const t = (await getDictionary(lang)).nakath;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{fill(t.dateTitle, { date: dayText(date, lang) })}</h1>
        <p className="soft">{t.lead}</p>
      </div>
      <Suspense fallback={<p className={styles.status}>{t.loading}</p>}>
        <Loaded lang={lang} t={t} day={date} />
      </Suspense>
    </main>
  );
}
