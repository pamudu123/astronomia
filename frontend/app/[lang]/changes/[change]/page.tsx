import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChangeSummary } from "@/components/changes/ChangeSummary";
import styles from "@/components/changes/Changes.module.css";
import { LagnaGrid } from "@/components/changes/LagnaGrid";
import { PersonalChange } from "@/components/changes/PersonalChange";
import { changeTitle, localDate, moveText } from "@/components/changes/text";
import { PUBLISHED, findChange } from "@/lib/changes";
import { fill } from "@/lib/hadahan";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../../dictionaries";

type Params = PageProps<"/[lang]/changes/[change]">;

export function generateStaticParams() {
  return PUBLISHED.map((change) => ({ change: change.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, change: id } = await params;
  const change = findChange(id);
  if (!hasLocale(lang) || !change) return {};
  const t = (await getDictionary(lang)).changes;
  const values = {
    name: changeTitle(t, change, lang),
    date: localDate(change, lang),
    moves: change.moves.map((move) => moveText(t, move, lang)).join(" "),
  };
  const title = fill(t.metaHubTitle, values);
  const description = fill(t.metaHubDescription, values);
  return {
    title,
    description,
    alternates: {
      canonical: `/${lang}/changes/${change.id}`,
      languages: { si: `/si/changes/${change.id}`, en: `/en/changes/${change.id}` },
    },
    openGraph: {
      title,
      description,
      images: [{ url: "/images/share-preview.jpg", width: 1200, height: 630 }],
    },
  };
}

/** One change for all twelve lagnas. Needs no backend, so all of it is in the page as served. */
export default async function ChangeHubPage({ params }: Params) {
  const { lang, change: id } = await params;
  const change = findChange(id);
  if (!hasLocale(lang) || !change) notFound();
  const dict = await getDictionary(lang);
  const t = dict.changes;

  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{changeTitle(t, change, lang)}</h1>
        <p className="soft">{t.hubLead}</p>
        <div className={styles.links}>
          <Link href={`/${lang}/changes`}>{t.all}</Link>
        </div>
      </div>
      <ChangeSummary t={t} change={change} lang={lang} />
      <section className={styles.section} aria-labelledby="lagnas-title">
        <h2 id="lagnas-title" className={`display ${styles.sectionTitle}`}>
          {t.chooseLagna}
        </h2>
        <LagnaGrid t={t} change={change} lang={lang} />
      </section>
      <PersonalChange t={t} hadahan={dict.hadahan} lang={lang} changeId={change.id} />
      <div className={styles.note}>
        <p>{t.rashiNoteAll}</p>
        <p>{t.provisional}</p>
        <p>{t.method}</p>
      </div>
    </main>
  );
}
