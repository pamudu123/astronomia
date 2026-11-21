"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";
import { callbackParams, finishSignIn, safeNext } from "@/lib/supabase";

import styles from "./MyReports.module.css";

type Props = { lang: Locale; t: Dictionary["saved"] };

/**
 * Back from Google. A guest who linked Google is now the same account with Google added; someone
 * signing in on another device is now signed in. Then on to where they came from.
 */
export function AuthCallback({ lang, t }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const { code, error, next } = callbackParams(window.location.href);
    const work = error || !code ? Promise.reject(new Error(error ?? "no code")) : finishSignIn(code);
    work.then(
      () => window.location.replace(safeNext(next, lang)),
      () => setFailed(true),
    );
  }, [lang]);

  return (
    <main id="main" className={`container ${styles.page}`}>
      <header className={`rise ${styles.head}`}>
        <h1 className={`display ${styles.title}`}>{t.callbackTitle}</h1>
      </header>
      {failed ? (
        <div className={styles.empty}>
          <p role="alert">{t.callbackFailed}</p>
          <Link href={`/${lang}/my`} className="btn btn-outline lift">
            {t.back}
          </Link>
        </div>
      ) : (
        <p role="status" className="soft">
          {t.callbackWorking}
        </p>
      )}
    </main>
  );
}
