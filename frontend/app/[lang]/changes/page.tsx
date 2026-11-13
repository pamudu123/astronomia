import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlanetIcon } from "@/components/PlanetIcon";
import styles from "@/components/changes/Changes.module.css";
import { changeTitle, moveText, whenText } from "@/components/changes/text";
import { CHANGES } from "@/lib/changes";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/changes">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).changes;
  return {
    title: t.metaIndexTitle,
    description: t.metaIndexDescription,
    alternates: {
      canonical: `/${lang}/changes`,
      languages: { si: "/si/changes", en: "/en/changes" },
    },
  };
}

/** Every planet change in order. Built from the list in lib/changes.ts, so it needs no backend. */
export default async function ChangesPage({ params }: PageProps<"/[lang]/changes">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (await getDictionary(lang)).changes;

  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
        <h1 className={`display ${styles.title}`}>{t.indexTitle}</h1>
        <p className="soft">{t.indexLead}</p>
      </div>
      <ol className={styles.timeline}>
        {CHANGES.map((change) => (
          <li key={change.id} className={change.published ? styles.eventLive : styles.event} data-change={change.id}>
            <PlanetIcon body={change.moves[0].body} />
            <div className={styles.eventBody}>
              <h2 className="display">
                {change.published ? (
                  <Link href={`/${lang}/changes/${change.id}`}>{changeTitle(t, change)}</Link>
                ) : (
                  changeTitle(t, change)
                )}
              </h2>
              <p className={styles.when}>
                <time dateTime={change.moment}>{whenText(t, change, lang)}</time>
              </p>
              {change.moves.map((move) => (
                <p key={move.body}>{moveText(t, move, lang)}</p>
              ))}
              {!change.published && <span className={styles.soon}>{t.soon}</span>}
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.note}>
        <p>{t.provisional}</p>
        <p>{t.method}</p>
      </div>
    </main>
  );
}
