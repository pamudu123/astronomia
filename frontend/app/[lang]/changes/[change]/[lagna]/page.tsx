import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ChangeDetail } from "@/components/changes/ChangeDetail";
import { ChangeSummary } from "@/components/changes/ChangeSummary";
import styles from "@/components/changes/Changes.module.css";
import { LagnaGrid } from "@/components/changes/LagnaGrid";
import { PersonalChange } from "@/components/changes/PersonalChange";
import { type ChangesText, changeTitle, localDate, moveText } from "@/components/changes/text";
import { type ChangeLagna, PUBLISHED, changeLagnaPath, findChange, findLagna } from "@/lib/changes";
import { fill } from "@/lib/hadahan";
import { type Locale, hasLocale } from "@/lib/i18n";
import { RASHI } from "@/lib/rashi";
import { backendHeaders } from "@/lib/staging";

import { getDictionary } from "../../../dictionaries";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

type Params = PageProps<"/[lang]/changes/[change]/[lagna]">;

export function generateStaticParams() {
  return PUBLISHED.flatMap((change) => RASHI.map((rashi) => ({ change: change.id, lagna: rashi.key })));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, change: id, lagna: key } = await params;
  const change = findChange(id);
  const lagna = findLagna(key);
  if (!hasLocale(lang) || !change || !lagna) return {};
  const t = (await getDictionary(lang)).changes;
  const values = {
    name: changeTitle(t, change, lang),
    lagna: lagna[lang],
    date: localDate(change, lang),
    moves: change.moves.map((move) => moveText(t, move, lang)).join(" "),
  };
  const title = fill(t.metaLagnaTitle, values);
  const description = fill(t.metaLagnaDescription, values);
  const path = `/changes/${change.id}/${lagna.key}`;
  return {
    title,
    description,
    alternates: {
      canonical: `/${lang}${path}`,
      languages: { si: `/si${path}`, en: `/en${path}` },
    },
    openGraph: {
      title,
      description,
      images: [{ url: "/images/share-preview.jpg", width: 1200, height: 630 }],
    },
  };
}

/** The houses for this lagna, so they are in the page a search engine reads. Null when the backend is away. */
async function loadLagna(id: string, lagna: string, lang: Locale): Promise<ChangeLagna | null> {
  try {
    const response = await fetch(`${BACKEND}${changeLagnaPath(id, lagna, lang)}`, {
      cache: "no-store",
      headers: backendHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? ((await response.json()) as ChangeLagna) : null;
  } catch {
    return null;
  }
}

async function LoadedDetail(props: { t: ChangesText; lang: Locale; changeId: string; lagna: string }) {
  return <ChangeDetail {...props} initial={await loadLagna(props.changeId, props.lagna, props.lang)} />;
}

export default async function ChangeLagnaPage({ params }: Params) {
  const { lang, change: id, lagna: key } = await params;
  const change = findChange(id);
  const lagna = findLagna(key);
  if (!hasLocale(lang) || !change || !lagna) notFound();
  const dict = await getDictionary(lang);
  const t = dict.changes;
  const name = changeTitle(t, change, lang);
  const title = fill(t.lagnaTitle, { name, lagna: lagna[lang] });

  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{title}</h1>
        <div className={styles.links}>
          <Link href={`/${lang}/changes/${change.id}`}>{fill(t.hubLink, { name })}</Link>
          <Link href={`/${lang}/changes`}>{t.all}</Link>
        </div>
      </div>
      <ChangeSummary t={t} change={change} lang={lang} />
      {/* The houses are asked for at request time, so they stream in behind this boundary. */}
      <Suspense fallback={<p className={styles.status}>{t.loading}</p>}>
        <LoadedDetail t={t} lang={lang} changeId={change.id} lagna={lagna.key} />
      </Suspense>
      <div className={styles.note}>
        <p>{fill(t.rashiNote, { lagna: lagna[lang] })}</p>
        <p>{t.provisional}</p>
        <p>{t.method}</p>
      </div>
      <PersonalChange t={t} hadahan={dict.hadahan} lang={lang} changeId={change.id} current={lagna.key} />
      <section className={styles.section} aria-labelledby="lagnas-title">
        <h2 id="lagnas-title" className={`display ${styles.sectionTitle}`}>
          {t.otherLagnas}
        </h2>
        <LagnaGrid t={t} change={change} lang={lang} current={lagna.key} />
      </section>
    </main>
  );
}
