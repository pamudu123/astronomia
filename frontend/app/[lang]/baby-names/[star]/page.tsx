import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import styles from "@/components/babynames/BabyNames.module.css";
import { StarLetters } from "@/components/babynames/StarLetters";
import { STAR_LETTERS, type StarLettersResponse, starLettersPath } from "@/lib/babynames";
import { backendJson } from "@/lib/backend";
import { fill } from "@/lib/hadahan";
import { type Locale, hasLocale } from "@/lib/i18n";
import { NAKSHATRA, findNakshatra } from "@/lib/nakshatra";

import { type Dictionary, getDictionary } from "../../dictionaries";

type Params = PageProps<"/[lang]/baby-names/[star]">;

export function generateStaticParams() {
  return NAKSHATRA.map((star) => ({ star: star.key }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, star: key } = await params;
  const star = findNakshatra(key);
  if (!hasLocale(lang) || !star) return {};
  const t = (await getDictionary(lang)).babyNames;
  const letters = STAR_LETTERS[star.key].join(" ");
  const title = fill(t.metaStarTitle, { star: star[lang], letters });
  const description = fill(t.metaStarDescription, { star: star[lang], letters });
  return {
    title,
    description,
    alternates: {
      canonical: `/${lang}/baby-names/${star.key}`,
      languages: { si: `/si/baby-names/${star.key}`, en: `/en/baby-names/${star.key}` },
    },
    openGraph: {
      title,
      description,
      images: [{ url: "/images/share-preview.jpg", width: 1200, height: 630 }],
    },
  };
}

async function Loaded({ lang, t, star }: { lang: Locale; t: Dictionary["babyNames"]; star: string }) {
  const initial = await backendJson<StarLettersResponse>(starLettersPath(star, lang));
  return <StarLetters t={t} lang={lang} star={star} initial={initial} />;
}

export default async function StarLettersPage({ params }: Params) {
  const { lang, star: key } = await params;
  const star = findNakshatra(key);
  if (!hasLocale(lang) || !star) notFound();
  const t = (await getDictionary(lang)).babyNames;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{fill(t.starTitle, { star: star[lang] })}</h1>
        <p className="soft">{fill(t.starLead, { star: star[lang] })}</p>
        <Link href={`/${lang}/baby-names`} className={styles.back}>
          {t.all}
        </Link>
      </div>
      {/* The letters are asked for at request time, so they stream in behind this boundary. */}
      <Suspense fallback={<p className={styles.status}>{t.loading}</p>}>
        <Loaded lang={lang} t={t} star={star.key} />
      </Suspense>
      <Link href={`/${lang}/baby-names`} className="btn btn-primary lift" style={{ alignSelf: "flex-start" }}>
        {t.findOwn}
      </Link>
    </main>
  );
}
