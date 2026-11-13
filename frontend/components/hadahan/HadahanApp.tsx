"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import {
  type BirthRequest,
  type Hadahan,
  type Labels,
  type SavedResult,
  fetchHadahan,
  fetchLabels,
  fill,
  loadResult,
  saveResult,
} from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { clearHandoff, handoffSnapshot, parseHandoff } from "@/lib/kendara";

import { BirthForm, EMPTY_FORM, type FormValues } from "./BirthForm";
import styles from "./BirthForm.module.css";
import { HadahanResult } from "./HadahanResult";

type View =
  | { kind: "form" }
  | { kind: "choice"; pending: Omit<SavedResult, "result">; result: Hadahan }
  | { kind: "result"; saved: SavedResult };

type Props = {
  lang: Locale;
  t: Dictionary["hadahan"];
  share: Dictionary["share"];
  yearly?: Dictionary["yearly"];
  /** Text for the link to the old horoscope search, and for a form filled from it. */
  kendara?: Dictionary["kendara"];
};

const noop = () => () => {};

/**
 * The hadahan page. A birth sent from the old horoscope search is read once the page is live,
 * and the form is remounted with it filled in.
 */
export function HadahanApp(props: Props) {
  const raw = useSyncExternalStore(noop, handoffSnapshot, () => "");
  const handoff = parseHandoff(raw, "hadahan");
  return <HadahanPage key={handoff ? raw : ""} {...props} handoff={handoff} />;
}

function HadahanPage({
  lang,
  t,
  share,
  yearly,
  kendara,
  handoff,
}: Props & { handoff: ReturnType<typeof parseHandoff> }) {
  const [labels, setLabels] = useState<Labels | null>(null);
  const [view, setView] = useState<View>({ kind: "form" });
  const [form, setForm] = useState<FormValues>(
    handoff ? { ...EMPTY_FORM, date: handoff.date, time: handoff.time, place: handoff.place } : EMPTY_FORM,
  );
  const [filled, setFilled] = useState(Boolean(handoff));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLabels(lang)
      .then(setLabels)
      .catch(() => setError(t.errors.failed));
  }, [lang, t.errors.failed]);

  // Bring back the last result in this tab, in the current language.
  useEffect(() => {
    if (handoff) return; // a birth just sent here wins over an older result
    const saved = loadResult();
    if (!saved) return;
    fetchHadahan(saved.request, lang)
      .then((result) => {
        if (result.status === "ok") setView({ kind: "result", saved: { ...saved, result } });
      })
      .catch(() => saveResult(null));
  }, [lang, handoff]);

  async function run(request: BirthRequest, pending: Omit<SavedResult, "result">) {
    setBusy(true);
    setError(null);
    try {
      const result = await fetchHadahan(request, lang);
      if (result.status === "ok") {
        const saved = { ...pending, request, result };
        saveResult(saved);
        setView({ kind: "result", saved });
        window.scrollTo({ top: 0 });
      } else {
        setView({ kind: "choice", pending: { ...pending, request }, result });
      }
    } catch (caught) {
      const status = (caught as { status?: number }).status;
      setError(status === 404 ? t.errors.notFound : t.errors.failed);
    } finally {
      setBusy(false);
    }
  }

  if (view.kind === "result" && labels) {
    const { saved } = view;
    return (
      <HadahanResult
        lang={lang}
        t={t.result}
        labels={labels}
        result={saved.result}
        name={saved.name}
        date={saved.request.date}
        time={saved.request.time}
        placeText={saved.placeLabel}
        share={share}
        request={saved.request}
        yearly={yearly}
        onEdit={() => {
          saveResult(null);
          setView({ kind: "form" });
        }}
      />
    );
  }

  if (view.kind === "choice") {
    const { result, pending } = view;
    const ambiguous = result.status === "ambiguous";
    return (
      <main id="main" className={`container ${styles.page}`}>
        <section className={`rise ${styles.card}`} aria-labelledby="clock-title">
          <h1 id="clock-title" className={`display ${styles.title}`}>
            {ambiguous ? t.clock.ambiguousTitle : t.clock.nonexistentTitle}
          </h1>
          <p className="soft">
            {fill(ambiguous ? t.clock.ambiguous : t.clock.nonexistent, { time: pending.request.time })}
          </p>
          <div className={styles.manual}>
            {result.time.options.map((option) => (
              <button
                key={option.fold}
                type="button"
                className="btn btn-outline lift"
                disabled={busy}
                onClick={() => run({ ...pending.request, fold: option.fold }, pending)}
              >
                {fill(t.clock.option, { offset: option.offset_label, abbreviation: option.abbreviation })}
              </button>
            ))}
          </div>
          <button type="button" className={styles.linkButton} onClick={() => setView({ kind: "form" })}>
            {t.result.edit}
          </button>
        </section>
      </main>
    );
  }

  return (
    <BirthForm
      lang={lang}
      t={t}
      initial={form}
      busy={busy || !labels}
      error={error}
      kendara={kendara}
      notice={filled ? kendara?.handoff.notice : undefined}
      onSubmit={(request, values, placeText) => {
        clearHandoff();
        setFilled(false);
        setForm(values);
        void run(request, { name: values.name.trim(), placeLabel: placeText, request });
      }}
    />
  );
}
