"use client";

import Link from "next/link";
import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { BirthForm, EMPTY_FORM, type FormValues } from "@/components/hadahan/BirthForm";
import { type PersonalChange as Data, fetchPersonalChange } from "@/lib/changes";
import { type BirthRequest, fill, loadResult } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { useHydrated } from "@/lib/useHydrated";

import styles from "./Changes.module.css";
import { CountedView } from "./CountedView";
import { type ChangesText, lagnaName } from "./text";

type Props = {
  t: ChangesText;
  hadahan: Dictionary["hadahan"];
  lang: Locale;
  changeId: string;
  /** The lagna of the page it sits on, if any. */
  current?: string;
};

/** "Your own version": the change counted from the visitor's lagna and Moon sign. */
export function PersonalChange({ t, hadahan, lang, changeId, current }: Props) {
  const p = t.personal;
  const hydrated = useHydrated();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Data | null>(null);
  const [clock, setClock] = useState(false);

  // A hadahan made earlier in this tab saves typing. It stays in this tab only, and is
  // read only after hydration so the server and browser render the same first.
  const saved = hydrated ? loadResult() : null;

  async function run(request: BirthRequest) {
    setBusy(true);
    setError(null);
    setClock(false);
    try {
      const answer = await fetchPersonalChange(changeId, request, lang);
      if (answer.status === "ok") {
        setResult(answer);
        setShowForm(false);
      } else {
        setClock(true);
      }
    } catch {
      setError(hadahan.errors.failed);
    } finally {
      setBusy(false);
    }
  }

  if (result?.lagna && result.gochara) {
    const lagna = result.lagna.sign;
    return (
      <section className={styles.personal} aria-labelledby="personal-title" data-card="personal">
        <h2 id="personal-title" className={`display ${styles.sectionTitle}`}>
          {p.title}
        </h2>
        <p className={styles.facts}>
          <span>{fill(p.yourLagna, { lagna: result.lagna.sign_name })}</span>
          <span>{fill(p.yourMoon, { sign: result.gochara.sign_name })}</span>
        </p>
        <CountedView
          t={t}
          change={result.change}
          counted={result.lagna}
          id="personal-lagna"
          heading={fill(p.fromLagna, { lagna: result.lagna.sign_name })}
        />
        <CountedView
          t={t}
          change={result.change}
          counted={result.gochara}
          id="personal-moon"
          heading={fill(p.fromMoon, { sign: result.gochara.sign_name })}
        />
        <div className={styles.actions}>
          {lagna !== current && (
            <Link href={`/${lang}/changes/${changeId}/${lagna}`} className="btn btn-outline lift">
              {fill(p.lagnaPage, { lagna: lagnaName(lagna, lang) })}
            </Link>
          )}
          <button type="button" className={styles.linkButton} onClick={() => setResult(null)}>
            {p.again}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.personal} aria-labelledby="personal-title" data-card="personal">
      {!showForm && (
        <>
          <h2 id="personal-title" className={`display ${styles.sectionTitle}`}>
            {p.title}
          </h2>
          <p className="soft">{p.lead}</p>
          <div className={styles.actions}>
            {saved && (
              <button
                type="button"
                className="btn btn-primary lift"
                disabled={busy || !hydrated}
                onClick={() => void run(saved.request)}
              >
                {busy ? p.working : saved.name ? fill(p.useSavedNamed, { name: saved.name }) : p.useSaved}
              </button>
            )}
            <button
              type="button"
              className={`btn ${saved ? "btn-outline" : "btn-primary"} lift`}
              disabled={!hydrated}
              onClick={() => setShowForm(true)}
            >
              {p.other}
            </button>
          </div>
        </>
      )}
      {showForm && (
        <BirthForm
          lang={lang}
          t={hadahan}
          initial={form}
          busy={busy}
          error={error}
          embedded={{ title: p.title, lead: p.lead, submit: p.submit, working: p.working }}
          onSubmit={(request, values) => {
            setForm(values);
            void run(request);
          }}
        />
      )}
      {clock && (
        <p className={styles.small} role="alert">
          {p.clock}
        </p>
      )}
      {error && !showForm && (
        <p className={styles.small} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
