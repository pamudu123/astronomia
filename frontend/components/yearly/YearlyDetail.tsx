"use client";

import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";
import { type Year, fetchYear } from "@/lib/yearly";

import styles from "./Yearly.module.css";
import { YearView } from "./YearView";

type Props = {
  t: Dictionary["yearly"];
  names: Pick<Dictionary["changes"], "planet" | "house">;
  lang: Locale;
  year: number;
  lagna: string;
  /** From the server when it could reach the backend. Otherwise the browser asks. */
  initial: Year | null;
};

export function YearlyDetail({ t, names, lang, year, lagna, initial }: Props) {
  const [data, setData] = useState<Year | null>(initial);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (data) return;
    let stale = false;
    fetchYear(year, lagna, lang)
      .then((result) => !stale && setData(result))
      .catch(() => !stale && setFailed(true));
    return () => {
      stale = true;
    };
  }, [data, year, lagna, lang, attempt]);

  if (!data) {
    return (
      <div className={styles.section} role="status">
        <p className={styles.small}>{failed ? t.failed : t.loading}</p>
        {failed && (
          <button
            type="button"
            className="btn btn-outline lift"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            {t.retry}
          </button>
        )}
      </div>
    );
  }
  return <YearView t={t} names={names} year={data} lang={lang} id="lagna" />;
}
