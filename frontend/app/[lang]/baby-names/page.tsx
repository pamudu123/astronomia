import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BabyLettersApp } from "@/components/babynames/BabyLettersApp";
import styles from "@/components/babynames/BabyNames.module.css";
import { STAR_LETTERS } from "@/lib/babynames";
import { type Locale, hasLocale } from "@/lib/i18n";
import { NAKSHATRA } from "@/lib/nakshatra";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/baby-names">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).babyNames;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${lang}/baby-names`,
      languages: { si: "/si/baby-names", en: "/en/baby-names" },
    },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      images: [{ url: "/images/share-preview.jpg", width: 1200, height: 630 }],
    },
  };
}

/** The 27 stars with their four letters. */
function StarGrid({ lang }: { lang: Locale }) {
  return (
    <ol className={styles.starGrid}>
      {NAKSHATRA.map((star, index) => (
        <li key={star.key}>
          <Link href={`/${lang}/baby-names/${star.key}`} className={`lift ${styles.starCard}`}>
            <span className={styles.starNumber}>{index + 1}</span>
            <span className={styles.starName}>{star[lang]}</span>
            <span className={`sinhala ${styles.starLetters}`} lang="si">
              {STAR_LETTERS[star.key].join(" ")}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export default async function BabyNamesPage({ params }: PageProps<"/[lang]/baby-names">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.babyNames;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{t.title}</h1>
        <p className="soft">{t.lead}</p>
      </div>
      <BabyLettersApp t={t} hadahan={dict.hadahan} lang={lang} />
      <section aria-labelledby="stars-title" className={styles.head}>
        <h2 id="stars-title" className={`display ${styles.sectionTitle}`}>
          {t.indexTitle}
        </h2>
        <p className="soft">{t.indexLead}</p>
      </section>
      <StarGrid lang={lang} />
      <Link href={`/${lang}/first-letters`} className="btn btn-outline lift" style={{ alignSelf: "flex-start" }}>
        {dict.firstLetters.link}
      </Link>
      <p className={styles.small}>{t.provisional}</p>
    </main>
  );
}
