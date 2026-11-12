"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { HadahanResult } from "@/components/hadahan/HadahanResult";
import { ShareIcon } from "@/components/Icons";
import { PorondamResult } from "@/components/porondam/PorondamResult";
import { type Labels, fetchLabels, fill, formatDate } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { type Shared, deleteShare, deleteTokenFor, fetchShare } from "@/lib/share";

import styles from "./SharedApp.module.css";

type View =
  | { kind: "loading" }
  | { kind: "gone"; deleted: boolean }
  | { kind: "ok"; shared: Shared; labels: Labels; token: string | null };

type Props = { lang: Locale; code: string; dict: Dictionary };

/** A shared hadahan or match, read only. It holds no birth details beyond what was shared. */
export function SharedApp({ lang, code, dict }: Props) {
  const t = dict.share;
  const [view, setView] = useState<View>({ kind: "loading" });
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let current = true;
    Promise.all([fetchShare(code, lang), fetchLabels(lang)])
      .then(([shared, labels]) => {
        if (current) setView({ kind: "ok", shared, labels, token: deleteTokenFor(code) });
      })
      .catch(() => {
        if (current) setView({ kind: "gone", deleted: false });
      });
    return () => {
      current = false;
    };
  }, [code, lang]);

  async function remove(token: string) {
    setDeleting(true);
    setError(false);
    try {
      await deleteShare(code, token);
      setView({ kind: "gone", deleted: true });
      window.scrollTo({ top: 0 });
    } catch {
      setError(true);
    } finally {
      setDeleting(false);
    }
  }

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
        <section className={`rise ${styles.gone}`} data-share-gone>
          <Image src="/images/moon.png" alt="" width={160} height={160} className={styles.moon} />
          <h1 className={`display ${styles.goneTitle}`}>{view.deleted ? t.deletedTitle : t.goneTitle}</h1>
          <p className="soft">{view.deleted ? t.deletedText : t.goneText}</p>
          <div className={styles.links}>
            <Link href={`/${lang}/hadahan`} className="btn btn-primary lift">
              {t.homeHadahan}
            </Link>
            <Link href={`/${lang}/porondam`} className="btn btn-outline lift">
              {t.homePorondam}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const { shared, labels, token } = view;
  const makeOwn = shared.kind === "hadahan" ? `/${lang}/hadahan` : `/${lang}/porondam`;

  return (
    <>
      <div className={`container ${styles.bannerWrap}`}>
        <aside className={`rise ${styles.banner}`} data-share-banner>
          <span className={styles.pill}>
            <ShareIcon size={16} />
            {t.banner}
          </span>
          <span className="soft">{fill(t.openUntil, { date: formatDate(shared.expires_at, lang) })}</span>
          <span className={styles.spacer} />
          {token && (
            <button type="button" className={styles.delete} onClick={() => remove(token)} disabled={deleting}>
              {deleting ? t.deleting : t.delete}
            </button>
          )}
          <Link href={makeOwn} className={styles.own}>
            {shared.kind === "hadahan" ? t.makeOwnHadahan : t.makeOwnPorondam}
          </Link>
          {error && (
            <p role="alert" className={styles.error}>
              {t.deleteFailed}
            </p>
          )}
        </aside>
      </div>

      {shared.hadahan && (
        <HadahanResult
          lang={lang}
          t={dict.hadahan.result}
          labels={labels}
          result={shared.hadahan.result}
          name={shared.hadahan.name}
          date={shared.hadahan.date}
          time={shared.hadahan.time}
          placeText={shared.hadahan.place}
        />
      )}
      {shared.porondam && (
        <PorondamResult
          lang={lang}
          t={dict.porondam.result}
          f={dict.porondam.form}
          labels={labels}
          result={shared.porondam}
          readOnlyAction={
            <Link href={makeOwn} className="btn btn-outline lift">
              {t.makeOwnPorondam}
            </Link>
          }
        />
      )}
    </>
  );
}
