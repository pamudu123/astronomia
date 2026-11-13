import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { DailyView } from "@/components/nakath/DailyView";
import styles from "@/components/nakath/Nakath.module.css";
import { backendJson } from "@/lib/backend";
import { type Locale, hasLocale } from "@/lib/i18n";
import { COLOMBO, type Panchanga, SRI_LANKA, panchangaPath, todayIn } from "@/lib/nakath";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/nakath">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).nakath;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: `/${lang}/nakath`, languages: { si: "/si/nakath", en: "/en/nakath" } },
  };
}

/** Today depends on the moment of the request, so it is worked out then. */
async function Today({ lang, t }: { lang: Locale; t: Awaited<ReturnType<typeof getDictionary>>["nakath"] }) {
  await connection();
  const day = todayIn(SRI_LANKA);
  const initial = await backendJson<Panchanga>(panchangaPath(day, { placeId: COLOMBO }, lang));
  return <DailyView lang={lang} t={t} day={day} initial={initial} />;
}

export default async function TodayPage({ params }: PageProps<"/[lang]/nakath">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (await getDictionary(lang)).nakath;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{t.title}</h1>
        <p className="soft">{t.lead}</p>
      </div>
      <Suspense fallback={<p className={styles.status}>{t.loading}</p>}>
        <Today lang={lang} t={t} />
      </Suspense>
    </main>
  );
}
