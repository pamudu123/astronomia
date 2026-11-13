"use client";

import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { type StarLettersResponse, fetchStarLetters } from "@/lib/babynames";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import styles from "./BabyNames.module.css";
import { PadaCards } from "./PadaCards";

type Props = {
  t: Dictionary["babyNames"];
  lang: Locale;
  star: string;
  /** From the server, so the letters are in the page a search engine reads. Null if it failed. */
  initial: StarLettersResponse | null;
};

/** One star's four padas. Asks the backend itself when the server could not. */
export function StarLetters({ t, lang, star, initial }: Props) {
  const [data, setData] = useState<StarLettersResponse | null>(initial);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (data) return;
    let live = true;
    fetchStarLetters(star, lang)
      .then((answer) => live && setData(answer))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [data, star, lang, attempt]);

  if (!data) {
    return failed ? (
      <div className={styles.panel} role="alert">
        <p>{t.failed}</p>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        >
          {t.retry}
        </button>
      </div>
    ) : (
      <p className={styles.status}>{t.loading}</p>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="padas-title" data-card="star-letters">
      <h2 id="padas-title" className={`display ${styles.sectionTitle}`}>
        {fill(t.allPadas, { star: data.star_name })}
      </h2>
      <PadaCards t={t} padas={data.padas} />
      <p className={styles.small}>{t.whichPada}</p>
      <p className={styles.small}>
        {t.provisional} {fill(t.method, { rules: data.rule_set })}
      </p>
    </section>
  );
}
