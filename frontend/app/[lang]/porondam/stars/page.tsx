import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/porondam/StarMatches.module.css";
import { hasLocale } from "@/lib/i18n";
import { NAKSHATRA, starSigns } from "@/lib/nakshatra";
import { RASHI } from "@/lib/rashi";

import { getDictionary } from "../../dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/porondam/stars">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).porondam.stars;
  return {
    title: t.metaIndexTitle,
    description: t.metaIndexDescription,
    alternates: {
      canonical: `/${lang}/porondam/stars`,
      languages: { si: "/si/porondam/stars", en: "/en/porondam/stars" },
    },
  };
}

export default async function StarsPage({ params }: PageProps<"/[lang]/porondam/stars">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (await getDictionary(lang)).porondam.stars;
  const rashiName = (key: string) => RASHI.find((rashi) => rashi.key === key)?.[lang] ?? key;

  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{t.indexTitle}</h1>
        <p className="soft">{t.indexLead}</p>
      </div>
      <ol className={styles.starGrid}>
        {NAKSHATRA.map((star, index) => (
          <li key={star.key}>
            <Link href={`/${lang}/porondam/stars/${star.key}`} className={`lift ${styles.starCard}`}>
              <span className={styles.starNumber}>{index + 1}</span>
              <span className={styles.starName}>{star[lang]}</span>
              <span className={styles.small}>
                {starSigns(star.key)
                  .map((sign) => rashiName(sign.rashi))
                  .join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
