import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AvuruduView } from "@/components/nakath/AvuruduView";
import styles from "@/components/nakath/Nakath.module.css";
import { backendJson } from "@/lib/backend";
import { fill } from "@/lib/hadahan";
import { type Locale, hasLocale } from "@/lib/i18n";
import { AVURUDU_YEARS, type Avurudu, SRI_LANKA, avuruduPath, hasAvuruduYear } from "@/lib/nakath";

import { getDictionary } from "../../dictionaries";

type Params = PageProps<"/[lang]/avurudu/[year]">;

export function generateStaticParams() {
  return AVURUDU_YEARS.map((year) => ({ year: String(year) }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, year } = await params;
  if (!hasLocale(lang) || !hasAvuruduYear(year)) return {};
  const t = (await getDictionary(lang)).avurudu;
  const title = fill(t.metaTitle, { year });
  const description = fill(t.metaDescription, { year });
  return {
    title,
    description,
    alternates: {
      canonical: `/${lang}/avurudu/${year}`,
      languages: { si: `/si/avurudu/${year}`, en: `/en/avurudu/${year}` },
    },
    openGraph: { title, description, images: [{ url: "/images/share-preview.jpg", width: 1200, height: 630 }] },
  };
}

async function Loaded({ lang, t, year }: { lang: Locale; t: Awaited<ReturnType<typeof getDictionary>>["avurudu"]; year: number }) {
  const initial = await backendJson<Avurudu>(avuruduPath(year, SRI_LANKA, lang));
  return <AvuruduView lang={lang} t={t} year={year} zone={SRI_LANKA} fixed={false} initial={initial} />;
}

export default async function AvuruduYear({ params }: Params) {
  const { lang, year: param } = await params;
  if (!hasLocale(lang) || !hasAvuruduYear(param)) notFound();
  const year = Number(param);
  const t = (await getDictionary(lang)).avurudu;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{fill(t.title, { year })}</h1>
        <p className="soft">{t.lead}</p>
        <div className={styles.links}>
          <Link href={`/${lang}/avurudu`}>{t.allYears}</Link>
        </div>
      </div>
      {/* The list is asked for at request time, so it streams in behind this boundary. */}
      <Suspense fallback={<p className={styles.status}>{t.loading}</p>}>
        <Loaded lang={lang} t={t} year={year} />
      </Suspense>
    </main>
  );
}
