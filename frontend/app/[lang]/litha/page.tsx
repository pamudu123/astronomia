import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import styles from "@/components/litha/Litha.module.css";
import { LithaCalendar, monthTitle } from "@/components/litha/LithaCalendar";
import { backendJson } from "@/lib/backend";
import { fill } from "@/lib/hadahan";
import { type Locale, hasLocale } from "@/lib/i18n";
import { COLOMBO, type MonthPanchanga, SRI_LANKA, monthPath, todayIn } from "@/lib/nakath";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/litha">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).litha;
  return {
    title: t.indexTitle,
    description: t.lead,
    alternates: { canonical: `/${lang}/litha`, languages: { si: "/si/litha", en: "/en/litha" } },
  };
}

type T = Awaited<ReturnType<typeof getDictionary>>["litha"];

/** This month depends on the moment of the request, so it is worked out then. */
async function ThisMonth({ lang, t }: { lang: Locale; t: T }) {
  await connection();
  const today = todayIn(SRI_LANKA);
  const month = today.slice(0, 7);
  const data = await backendJson<MonthPanchanga>(
    monthPath(Number(month.slice(0, 4)), Number(month.slice(5)), COLOMBO, lang),
  );
  return (
    <>
      <h1 className={`display ${styles.title}`}>{fill(t.title, { month: monthTitle(month, lang) })}</h1>
      <p className="soft">{t.lead}</p>
      <LithaCalendar lang={lang} t={t} month={month} today={today} data={data} />
    </>
  );
}

export default async function LithaPage({ params }: PageProps<"/[lang]/litha">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (await getDictionary(lang)).litha;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <span className={`rise sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
      <Suspense
        fallback={
          <>
            <h1 className={`display ${styles.title}`}>{t.indexTitle}</h1>
            <p className="soft">{t.lead}</p>
          </>
        }
      >
        <ThisMonth lang={lang} t={t} />
      </Suspense>
    </main>
  );
}
