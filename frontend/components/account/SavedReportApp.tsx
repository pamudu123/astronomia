"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { HadahanResult } from "@/components/hadahan/HadahanResult";
import { PorondamResult } from "@/components/porondam/PorondamResult";
import { type SavedDetail, birthOf, getSaved, matchOf } from "@/lib/account";
import { type Labels, fetchLabels, fill, formatDate } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import styles from "./MyReports.module.css";
import { savedTitle } from "./MyReportsApp";

type View =
  | { kind: "loading" }
  | { kind: "gone" }
  | { kind: "ok"; saved: SavedDetail; labels: Labels };

type Props = { lang: Locale; id: string; dict: Dictionary };

/**
 * One saved report, as it was when saved. It comes with the details it was made from, so the
 * PDF and Share buttons work as on the result itself.
 */
export function SavedReportApp({ lang, id, dict }: Props) {
  const t = dict.saved;
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    let current = true;
    Promise.all([getSaved(id, lang), fetchLabels(lang)])
      .then(([saved, labels]) => {
        if (current) setView({ kind: "ok", saved, labels });
      })
      .catch(() => {
        if (current) setView({ kind: "gone" });
      });
    return () => {
      current = false;
    };
  }, [id, lang]);

  if (view.kind === "loading") {
    return (
      <main id="main" className={`container ${styles.page}`}>
        <p role="status" className="soft">
          {t.loading}
        </p>
      </main>
    );
  }

  if (view.kind === "gone") {
    return (
      <main id="main" className={`container ${styles.page}`}>
        <section className={`rise ${styles.empty}`} data-saved-gone>
          <Image src="/images/moon.png" alt="" width={160} height={160} className={styles.moon} />
          <h1 className={`display ${styles.title}`}>{t.goneTitle}</h1>
          <p className="soft">{t.goneText}</p>
          <Link href={`/${lang}/my`} className="btn btn-primary lift">
            {t.back}
          </Link>
        </section>
      </main>
    );
  }

  const { saved, labels } = view;
  const request = saved.request;

  return (
    <>
      <div className={`container ${styles.bannerWrap}`}>
        <aside className={`rise ${styles.banner}`} data-saved-banner>
          <span className={styles.pill}>{t.banner}</span>
          <span>{savedTitle(saved, dict)}</span>
          <span className="soft">{fill(t.savedOn, { date: formatDate(saved.created_at, lang) })}</span>
          <span className={styles.spacer} />
          <Link href={`/${lang}/my`} className={styles.back}>
            {t.back}
          </Link>
        </aside>
      </div>

      {saved.hadahan_result && request.kind === "hadahan" && (
        <HadahanResult
          lang={lang}
          t={dict.hadahan.result}
          labels={labels}
          result={saved.hadahan_result.result}
          name={saved.hadahan_result.name}
          date={saved.hadahan_result.date}
          time={saved.hadahan_result.time}
          placeText={saved.hadahan_result.place}
          share={dict.share}
          request={birthOf(request.birth)}
        />
      )}
      {saved.porondam_result && request.kind === "porondam" && (
        <PorondamResult
          lang={lang}
          t={dict.porondam.result}
          f={dict.porondam.form}
          labels={labels}
          result={saved.porondam_result}
          share={dict.share}
          request={matchOf(request.match)}
          timeline={dict.porondam.timeline}
        />
      )}
    </>
  );
}
