import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { StarMatches } from "@/components/porondam/StarMatches";
import styles from "@/components/porondam/StarMatches.module.css";
import { fill } from "@/lib/hadahan";
import { type Locale, hasLocale } from "@/lib/i18n";
import { NAKSHATRA, findNakshatra } from "@/lib/nakshatra";
import { RASHI } from "@/lib/rashi";
import { backendHeaders } from "@/lib/staging";
import { type StarMatches as Data, starMatchesPath } from "@/lib/starmatch";

import { getDictionary } from "../../../dictionaries";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

type Params = PageProps<"/[lang]/porondam/stars/[star]">;

export function generateStaticParams() {
  return NAKSHATRA.map((star) => ({ star: star.key }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, star: key } = await params;
  const star = findNakshatra(key);
  if (!hasLocale(lang) || !star) return {};
  const t = (await getDictionary(lang)).porondam.stars;
  const title = fill(t.metaTitle, { star: star[lang] });
  const description = fill(t.metaDescription, { star: star[lang] });
  return {
    title,
    description,
    alternates: {
      canonical: `/${lang}/porondam/stars/${star.key}`,
      languages: {
        si: `/si/porondam/stars/${star.key}`,
        en: `/en/porondam/stars/${star.key}`,
      },
    },
    openGraph: {
      title,
      description,
      images: [{ url: "/images/share-preview.jpg", width: 1200, height: 630 }],
    },
  };
}

/**
 * The first list (pada 1, as the bride), so the stars are in the page a search engine
 * reads. Null when the backend is away: the browser then asks for the list itself.
 */
async function loadMatches(star: string, lang: Locale): Promise<Data | null> {
  try {
    const response = await fetch(`${BACKEND}${starMatchesPath(star, 1, "bride", lang)}`, {
      cache: "no-store",
      headers: backendHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? ((await response.json()) as Data) : null;
  } catch {
    return null;
  }
}

type ListProps = Omit<React.ComponentProps<typeof StarMatches>, "initial">;

async function LoadedMatches(props: ListProps) {
  return <StarMatches {...props} initial={await loadMatches(props.star, props.lang)} />;
}

export default async function StarPage({ params }: Params) {
  const { lang, star: key } = await params;
  const star = findNakshatra(key);
  if (!hasLocale(lang) || !star) notFound();
  const t = (await getDictionary(lang)).porondam.stars;
  const rashiNames = Object.fromEntries(RASHI.map((rashi) => [rashi.key, rashi[lang]]));
  const list: ListProps = { lang, t, star: star.key, starName: star[lang], rashiNames };

  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{fill(t.title, { star: star[lang] })}</h1>
        <p className="soft">{fill(t.lead, { star: star[lang] })}</p>
        <Link href={`/${lang}/porondam/stars`} className={styles.back}>
          {t.all}
        </Link>
      </div>
      {/* The list is asked for at request time, so it streams in behind this boundary. */}
      <Suspense fallback={<p className={styles.status}>{t.loading}</p>}>
        <LoadedMatches {...list} />
      </Suspense>
    </main>
  );
}
