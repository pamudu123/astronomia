import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/babynames/BabyNames.module.css";
import { FirstLettersFinder } from "@/components/firstletters/FirstLettersFinder";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/first-letters">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).firstLetters;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${lang}/first-letters`,
      languages: { si: "/si/first-letters", en: "/en/first-letters" },
    },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      images: [{ url: "/images/share-preview.jpg", width: 1200, height: 630 }],
    },
  };
}

export default async function FirstLettersPage({ params }: PageProps<"/[lang]/first-letters">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.firstLetters;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{t.title}</h1>
        <p className="soft">{t.lead}</p>
        <Link href={`/${lang}/baby-names`} className={styles.back}>
          {dict.babyNames.homeLink}
        </Link>
      </div>
      <FirstLettersFinder lang={lang} t={t} hadahan={dict.hadahan} />
    </main>
  );
}
