"use client";

import Link from "next/link";
import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { BirthForm, EMPTY_FORM, type FormValues } from "@/components/hadahan/BirthForm";
import { type BabyLetters, fetchBabyLetters } from "@/lib/babynames";
import { type BirthRequest, fill, loadResult } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { useHydrated } from "@/lib/useHydrated";

import styles from "./BabyNames.module.css";
import { PadaCards } from "./PadaCards";

type Props = {
  t: Dictionary["babyNames"];
  hadahan: Dictionary["hadahan"];
  lang: Locale;
};

/** Birth details in, the birth star, pada and starting letters out. */
export function BabyLettersApp({ t, hadahan, lang }: Props) {
  const hydrated = useHydrated();
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(false);
  const [result, setResult] = useState<BabyLetters | null>(null);
  // A hadahan made earlier in this tab saves typing. Read only after hydration.
  const saved = hydrated ? loadResult() : null;

  async function run(request: BirthRequest) {
    setBusy(true);
    setError(null);
    setClock(false);
    try {
      const answer = await fetchBabyLetters(request, lang);
      if (answer.status === "ok") setResult(answer);
      else setClock(true);
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  const chart = result?.chart;
  if (result && chart && result.letter && result.star_letters) {
    const check = chart.time_check;
    const warn = !check.stable || result.nearby.length > 0;
    return (
      <section className={styles.panel} aria-labelledby="baby-result-title" data-card="baby-result">
        <h2 id="baby-result-title" className={`display ${styles.sectionTitle}`}>
          {t.letter}
        </h2>
        <div className={styles.answer}>
          <div className={styles.bigLetter} data-letter={result.letter.letter}>
            <span className={`sinhala ${styles.letter}`} lang="si">
              {result.letter.letter}
            </span>
            <span className={styles.latin}>{result.letter.latin}</span>
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>{t.star}</dt>
              <dd>{chart.star_name}</dd>
            </div>
            <div>
              <dt>{t.pada}</dt>
              <dd>{chart.pada}</dd>
            </div>
            <div>
              <dt>{t.rashi}</dt>
              <dd>{chart.rashi_name}</dd>
            </div>
            <div>
              <dt>{t.lagna}</dt>
              <dd>{chart.lagna_name}</dd>
            </div>
            <div>
              <dt>{t.weekday}</dt>
              <dd>{chart.weekday_name}</dd>
            </div>
          </dl>
        </div>
        <p className={styles.small}>
          {fill(t.timezone, { timezone: chart.timezone, offset: chart.offset })} · {chart.day_note}
        </p>
        <div className={`${styles.check} ${warn ? styles.checkWarn : ""}`} data-card="time-check">
          <span className={styles.checkTitle}>{t.timeCheck}</span>
          <p>{check.reason}</p>
          {result.nearby.map((near) => (
            <p key={`${near.star}-${near.pada}`}>{near.text}</p>
          ))}
          {warn && <p className={styles.small}>{t.timeNote}</p>}
        </div>

        <h3 className={`display ${styles.sectionTitle}`}>
          {fill(t.allPadas, { star: result.star_letters.star_name })}
        </h3>
        <PadaCards t={t} padas={result.star_letters.padas} current={chart.pada} />

        {result.lagna_letters && result.weekday_letters && (
          <>
            <h3 className={`display ${styles.sectionTitle}`}>{t.extraTitle}</h3>
            <p className="soft">{t.extraLead}</p>
            <div className={styles.extra}>
              <div className={styles.extraCard}>
                <span className={styles.small}>{fill(t.lagnaLetters, { lagna: result.lagna_letters.name })}</span>
                <span className={`sinhala ${styles.letterRow}`} lang="si">
                  {result.lagna_letters.letters.map((letter) => (
                    <span key={letter}>{letter}</span>
                  ))}
                </span>
              </div>
              <div className={styles.extraCard}>
                <span className={styles.small}>
                  {fill(t.weekdayLetters, { weekday: result.weekday_letters.name })}
                </span>
                <span className={`sinhala ${styles.letterRow}`} lang="si">
                  {result.weekday_letters.letters.map((letter) => (
                    <span key={letter}>{letter}</span>
                  ))}
                </span>
              </div>
            </div>
          </>
        )}
        <p className={styles.small}>
          {t.provisional} {fill(t.method, { rules: result.rule_set })}
        </p>
        <div className={styles.actions}>
          <Link href={`/${lang}/baby-names/${chart.star}`} className="btn btn-outline lift">
            {fill(t.starTitle, { star: chart.star_name })}
          </Link>
          <button type="button" className={styles.linkButton} onClick={() => setResult(null)}>
            {t.again}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.panel} data-card="baby-form">
      {saved && (
        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-outline lift"
            disabled={busy}
            onClick={() => void run(saved.request)}
          >
            {busy ? t.working : saved.name ? fill(t.useSavedNamed, { name: saved.name }) : t.useSaved}
          </button>
        </div>
      )}
      <BirthForm
        lang={lang}
        t={hadahan}
        initial={form}
        busy={busy}
        error={error}
        embedded={{ title: t.formTitle, lead: t.formLead, submit: t.submit, working: t.working }}
        onSubmit={(request, values) => {
          setForm(values);
          void run(request);
        }}
      />
      {clock && (
        <p className={styles.small} role="alert">
          {t.clock}
        </p>
      )}
    </section>
  );
}
