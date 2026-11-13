import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AvuruduView } from "@/components/nakath/AvuruduView";
import styles from "@/components/nakath/Nakath.module.css";
import { backendJson } from "@/lib/backend";
import { fill } from "@/lib/hadahan";
import { type Locale, hasLocale } from "@/lib/i18n";
import { type Avurudu, CITIES, type City, FEATURED_YEAR, avuruduPath, findCity } from "@/lib/nakath";

import { getDictionary } from "../../../dictionaries";

type Params = PageProps<"/[lang]/avurudu/[year]/[city]">;

/** City pages are for the next new year only. */
export function generateStaticParams() {
  return CITIES.map((city) => ({ year: String(FEATURED_YEAR), city: city.key }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, year, city: key } = await params;
  const city = findCity(key);
  if (!hasLocale(lang) || year !== String(FEATURED_YEAR) || !city) return {};
  const t = (await getDictionary(lang)).avurudu;
  const values = { year, city: city[lang] };
  const title = fill(t.metaCityTitle, values);
  const description = fill(t.metaCityDescription, values);
  const path = `/avurudu/${year}/${city.key}`;
  return {
    title,
    description,
    alternates: { canonical: `/${lang}${path}`, languages: { si: `/si${path}`, en: `/en${path}` } },
    openGraph: { title, description, images: [{ url: "/images/share-preview.jpg", width: 1200, height: 630 }] },
  };
}

async function Loaded({ lang, t, city }: { lang: Locale; t: Awaited<ReturnType<typeof getDictionary>>["avurudu"]; city: City }) {
  const initial = await backendJson<Avurudu>(avuruduPath(FEATURED_YEAR, city.timezone, lang));
  return <AvuruduView lang={lang} t={t} year={FEATURED_YEAR} zone={city.timezone} fixed initial={initial} />;
}

export default async function AvuruduCity({ params }: Params) {
  const { lang, year, city: key } = await params;
  const city = findCity(key);
  if (!hasLocale(lang) || year !== String(FEATURED_YEAR) || !city) notFound();
  const t = (await getDictionary(lang)).avurudu;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{fill(t.cityTitle, { year, city: city[lang] })}</h1>
        <p className="soft">{t.lead}</p>
        <div className={styles.links}>
          <Link href={`/${lang}/avurudu/${year}`}>{fill(t.title, { year })}</Link>
          <Link href={`/${lang}/avurudu`}>{t.allYears}</Link>
        </div>
      </div>
      <Suspense fallback={<p className={styles.status}>{t.loading}</p>}>
        <Loaded lang={lang} t={t} city={city} />
      </Suspense>
    </main>
  );
}
