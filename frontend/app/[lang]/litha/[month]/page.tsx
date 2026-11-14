import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import styles from "@/components/litha/Litha.module.css";
import { LithaCalendar, monthTitle } from "@/components/litha/LithaCalendar";
import { backendJson } from "@/lib/backend";
import { fill } from "@/lib/hadahan";
import { type Locale, hasLocale } from "@/lib/i18n";
import { COLOMBO, FEATURED_YEAR, type MonthPanchanga, SRI_LANKA, isMonth, monthPath, todayIn } from "@/lib/nakath";

import { getDictionary } from "../../dictionaries";

type Params = PageProps<"/[lang]/litha/[month]">;

/** One month is built ahead (the next new year's month); every other month is made on request. */
export function generateStaticParams() {
  return [{ month: `${FEATURED_YEAR}-04` }];
}

const valid = (value: string) =>
  isMonth(value) && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 2100;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, month } = await params;
  if (!hasLocale(lang) || !valid(month)) return {};
  const t = (await getDictionary(lang)).litha;
  const values = { month: monthTitle(month, lang) };
  return {
    title: fill(t.metaTitle, values),
    description: fill(t.metaDescription, values),
    alternates: {
      canonical: `/${lang}/litha/${month}`,
      languages: { si: `/si/litha/${month}`, en: `/en/litha/${month}` },
    },
  };
}

type T = Awaited<ReturnType<typeof getDictionary>>["litha"];

async function Loaded({ lang, t, month }: { lang: Locale; t: T; month: string }) {
  await connection();
  const data = await backendJson<MonthPanchanga>(
    monthPath(Number(month.slice(0, 4)), Number(month.slice(5)), COLOMBO, lang),
  );
  return <LithaCalendar lang={lang} t={t} month={month} today={todayIn(SRI_LANKA)} data={data} />;
}

export default async function LithaMonthPage({ params }: Params) {
  const { lang, month } = await params;
  if (!hasLocale(lang) || !valid(month)) notFound();
  const t = (await getDictionary(lang)).litha;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{fill(t.title, { month: monthTitle(month, lang) })}</h1>
        <p className="soft">{t.lead}</p>
      </div>
      <Suspense fallback={<p className={styles.status}>…</p>}>
        <Loaded lang={lang} t={t} month={month} />
      </Suspense>
    </main>
  );
}
