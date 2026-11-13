"use client";

import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import changeStyles from "@/components/changes/Changes.module.css";
import { BirthForm, EMPTY_FORM, type FormValues } from "@/components/hadahan/BirthForm";
import { type BirthRequest, fill, loadResult } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { useHydrated } from "@/lib/useHydrated";
import { type PersonalYear, fetchPersonalYear } from "@/lib/yearly";

import { YearView } from "./YearView";

type Props = {
  t: Dictionary["yearly"];
  names: Pick<Dictionary["changes"], "planet" | "house">;
  hadahan: Dictionary["hadahan"];
  lang: Locale;
  year: number;
};

/** "Your own 2027": the year counted from the visitor's lagna and Moon sign. */
export function PersonalYearly({ t, names, hadahan, lang, year }: Props) {
  const p = t.personal;
  const hydrated = useHydrated();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PersonalYear | null>(null);
  const [clock, setClock] = useState(false);
  // A hadahan made earlier in this tab saves typing. Read only after hydration.
  const saved = hydrated ? loadResult() : null;
  const title = fill(p.title, { year });

  async function run(request: BirthRequest) {
    setBusy(true);
    setError(null);
    setClock(false);
    try {
      const answer = await fetchPersonalYear(year, request, lang);
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
    return (
      <section className={changeStyles.personal} aria-labelledby="personal-year-title" data-card="personal-year">
        <h2 id="personal-year-title" className={`display ${changeStyles.sectionTitle}`}>
          {title}
        </h2>
        <p className={changeStyles.facts}>
          <span>{fill(p.yourLagna, { lagna: result.lagna.sign_name })}</span>
          <span>{fill(p.yourMoon, { sign: result.gochara.sign_name })}</span>
        </p>
        <YearView
          t={t}
          names={names}
         
          year={result.lagna}
          lang={lang}
          id="personal-lagna"
          heading={fill(p.fromLagna, { lagna: result.lagna.sign_name })}
        />
        <YearView
          t={t}
          names={names}
         
          year={result.gochara}
          lang={lang}
          id="personal-moon"
          heading={fill(p.fromMoon, { sign: result.gochara.sign_name })}
        />
        <button type="button" className={changeStyles.linkButton} onClick={() => setResult(null)}>
          {p.again}
        </button>
      </section>
    );
  }

  return (
    <section className={changeStyles.personal} aria-labelledby="personal-year-title" data-card="personal-year">
      {!showForm && (
        <>
          <h2 id="personal-year-title" className={`display ${changeStyles.sectionTitle}`}>
            {title}
          </h2>
          <p className="soft">{p.lead}</p>
          <div className={changeStyles.actions}>
            {saved && (
              <button
                type="button"
                className="btn btn-primary lift"
                disabled={busy}
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
          embedded={{ title, lead: p.lead, submit: p.submit, working: p.working }}
          onSubmit={(request, values) => {
            setForm(values);
            void run(request);
          }}
        />
      )}
      {clock && (
        <p className={changeStyles.small} role="alert">
          {p.clock}
        </p>
      )}
      {error && !showForm && (
        <p className={changeStyles.small} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
