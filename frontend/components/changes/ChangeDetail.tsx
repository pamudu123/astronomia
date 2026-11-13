"use client";

import { useEffect, useState } from "react";

import { type ChangeLagna, fetchChangeLagna } from "@/lib/changes";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import styles from "./Changes.module.css";
import { CountedView } from "./CountedView";
import type { ChangesText } from "./text";

type Props = {
  t: ChangesText;
  lang: Locale;
  changeId: string;
  lagna: string;
  /** From the server when it could reach the backend. Otherwise the browser asks. */
  initial: ChangeLagna | null;
};

export function ChangeDetail({ t, lang, changeId, lagna, initial }: Props) {
  const [data, setData] = useState<ChangeLagna | null>(initial);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (data) return;
    let stale = false;
    fetchChangeLagna(changeId, lagna, lang)
      .then((result) => !stale && setData(result))
      .catch(() => !stale && setFailed(true));
    return () => {
      stale = true;
    };
  }, [data, changeId, lagna, lang, attempt]);

  if (!data) {
    return (
      <div className={styles.status} role="status">
        {failed ? (
          <>
            <p>{t.failed}</p>
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
          </>
        ) : (
          <p>{t.loading}</p>
        )}
      </div>
    );
  }
  return (
    <>
      <CountedView t={t} change={data.change} counted={data.lagna} id="lagna" />
      {data.moon_notes.length > 0 && (
        <section className={styles.moonNotes} data-card="moon-notes">
          <h2 className={styles.planet}>{fill(t.moonNotes, { lagna: data.lagna.sign_name })}</h2>
          <ul className={styles.notes}>
            {data.moon_notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
