"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import {
  EMPTY_FORM,
  type FormValues,
  toRequest,
} from "@/components/hadahan/BirthForm";
import formStyles from "@/components/hadahan/BirthForm.module.css";
import { ArrowRight, Lock } from "@/components/Icons";
import {
  type Labels,
  fetchLabels,
  fill,
  loadSession,
  saveSession,
} from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { useHydrated } from "@/lib/useHydrated";
import {
  PORONDAM_KEY,
  type PersonInput,
  type Porondam,
  type PorondamRequest,
  type QuickInput,
  type SavedMatch,
  fetchPorondam,
} from "@/lib/porondam";
import { parseStarParam } from "@/lib/starmatch";

import { NAKSHATRA_ORDER, PersonCard } from "./PersonCard";
import styles from "./Porondam.module.css";
import { PorondamResult } from "./PorondamResult";

type Role = "bride" | "groom";
const EMPTY_QUICK: QuickInput = { name: "", nakshatra: "", pada: 1 };

type View =
  | { kind: "form" }
  | { kind: "choice"; request: PorondamRequest; result: Porondam }
  | { kind: "result"; saved: SavedMatch };

type Linked = Partial<Record<Role, { nakshatra: string; pada: number }>>;

const noChanges = () => () => undefined;

/**
 * A link from the star pages names two stars (?bride=anuradha.2&groom=rohini.1). The form
 * then opens on the quick match with them filled in. The query is read after the page is
 * live, so the server HTML and the first browser render agree.
 */
export function PorondamApp(props: { lang: Locale; dict: Dictionary }) {
  const search = useSyncExternalStore(
    noChanges,
    () => window.location.search,
    () => "",
  );
  const linked = useMemo<Linked | null>(() => {
    const query = new URLSearchParams(search);
    const bride = parseStarParam(query.get("bride"), NAKSHATRA_ORDER);
    const groom = parseStarParam(query.get("groom"), NAKSHATRA_ORDER);
    if (!bride && !groom) return null;
    return { ...(bride && { bride }), ...(groom && { groom }) };
  }, [search]);
  return <PorondamForm key={search} {...props} linked={linked} />;
}

function PorondamForm({
  lang,
  dict,
  linked,
}: {
  lang: Locale;
  dict: Dictionary;
  linked: Linked | null;
}) {
  const t = dict.porondam;
  const hydrated = useHydrated();
  const [labels, setLabels] = useState<Labels | null>(null);
  const [mode, setMode] = useState<"full" | "quick">(linked ? "quick" : "full");
  const [full, setFull] = useState<Record<Role, FormValues>>({
    bride: EMPTY_FORM,
    groom: EMPTY_FORM,
  });
  const [quick, setQuick] = useState<Record<Role, QuickInput>>({
    bride: { ...EMPTY_QUICK, ...linked?.bride },
    groom: { ...EMPTY_QUICK, ...linked?.groom },
  });
  const [view, setView] = useState<View>({ kind: "form" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLabels(lang)
      .then(setLabels)
      .catch(() => setError(t.errors.failed));
  }, [lang, t.errors.failed]);

  // Bring back the last match in this tab, in the current language. A link from the star
  // pages asks for a new match, so it wins.
  useEffect(() => {
    if (linked) return;
    const saved = loadSession<SavedMatch>(PORONDAM_KEY);
    if (!saved) return;
    fetchPorondam(saved.request, lang)
      .then((result) => {
        if (result.status === "ok")
          setView({ kind: "result", saved: { ...saved, result } });
      })
      .catch(() => saveSession(PORONDAM_KEY, null));
  }, [lang, linked]);

  function person(role: Role): PersonInput | null {
    if (mode === "quick") {
      const q = quick[role];
      return q.nakshatra
        ? { name: q.name.trim(), nakshatra: q.nakshatra, pada: q.pada }
        : null;
    }
    const request = toRequest(full[role]);
    return request ? { ...request, name: full[role].name.trim() } : null;
  }

  async function run(request: PorondamRequest) {
    setBusy(true);
    setError(null);
    try {
      const result = await fetchPorondam(request, lang);
      if (result.status === "ok") {
        const saved = { request, result };
        saveSession(PORONDAM_KEY, saved);
        setView({ kind: "result", saved });
        window.scrollTo({ top: 0 });
      } else {
        setView({ kind: "choice", request, result });
      }
    } catch (caught) {
      const status = (caught as { status?: number }).status;
      setError(status === 404 ? t.errors.notFound : t.errors.failed);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const bride = person("bride");
    const groom = person("groom");
    if (!bride || !groom) {
      setError(t.errors.missing);
      return;
    }
    void run({ bride, groom });
  }

  if (view.kind === "result" && labels) {
    return (
      <PorondamResult
        lang={lang}
        t={t.result}
        f={t.form}
        labels={labels}
        result={view.saved.result}
        share={dict.share}
        request={view.saved.request}
        timeline={t.timeline}
        onAgain={() => {
          saveSession(PORONDAM_KEY, null);
          setView({ kind: "form" });
        }}
      />
    );
  }

  if (view.kind === "choice") {
    const { request, result } = view;
    const role = (result.waiting_for ?? "bride") as Role;
    const ambiguous = result.status === "ambiguous";
    const who = role === "bride" ? t.form.bride : t.form.groom;
    const clock = dict.hadahan.clock;
    const own = request[role] as PersonInput & { time?: string };
    return (
      <main id="main" className={`container ${formStyles.page}`}>
        <section
          className={`rise ${formStyles.card}`}
          aria-labelledby="clock-title"
        >
          <p className={formStyles.eyebrow}>{fill(t.clockFor, { who })}</p>
          <h1 id="clock-title" className={`display ${formStyles.title}`}>
            {ambiguous ? clock.ambiguousTitle : clock.nonexistentTitle}
          </h1>
          <p className="soft">
            {fill(ambiguous ? clock.ambiguous : clock.nonexistent, {
              time: own.time ?? "",
            })}
          </p>
          <div className={formStyles.manual}>
            {result.time?.options.map((option) => (
              <button
                key={option.fold}
                type="button"
                className="btn btn-outline lift"
                disabled={busy}
                onClick={() =>
                  run({
                    ...request,
                    [role]: { ...request[role], fold: option.fold },
                  })
                }
              >
                {fill(clock.option, {
                  offset: option.offset_label,
                  abbreviation: option.abbreviation,
                })}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={formStyles.linkButton}
            onClick={() => setView({ kind: "form" })}
          >
            {dict.hadahan.result.edit}
          </button>
        </section>
      </main>
    );
  }

  const f = t.form;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.formHead}`}>
        <div className={styles.formIntro}>
          <span className={`sinhala ${styles.eyebrow}`}>{f.eyebrow}</span>
          <h1 className={`display ${styles.title}`}>{f.title}</h1>
          <p className="soft">{f.lead}</p>
        </div>
        <div role="group" aria-label={f.mode} className={styles.toggle}>
          {(["full", "quick"] as const).map((value) => (
            <button
              key={value}
              type="button"
              disabled={!hydrated}
              aria-pressed={mode === value}
              className={mode === value ? styles.toggleGold : styles.toggleOff}
              onClick={() => setMode(value)}
            >
              {value === "full" ? f.full : f.quick}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} noValidate className={styles.form}>
        <fieldset className="form-lock" disabled={!hydrated}>
          <div className={styles.people}>
            {(["bride", "groom"] as const).map((role, index) => (
              <div
                key={role}
                className={styles.personSlot}
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
              >
                <PersonCard
                  role={role}
                  lang={lang}
                  mode={mode}
                  full={full[role]}
                  quick={quick[role]}
                  labels={labels}
                  t={f}
                  h={dict.hadahan.form}
                  onFull={(update) =>
                    setFull((current) => ({
                      ...current,
                      [role]: update(current[role]),
                    }))
                  }
                  onQuick={(update) =>
                    setQuick((current) => ({
                      ...current,
                      [role]: update(current[role]),
                    }))
                  }
                />
              </div>
            ))}
          </div>

          {error && (
            <p className={formStyles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.submitRow}>
            <p className={styles.privacy}>
              <Lock /> {f.privacy}
            </p>
            <button
              type="submit"
              className={`btn btn-primary lift ${styles.submit}`}
              disabled={busy || !labels}
            >
              {busy ? f.working : f.submit}
              {!busy && <ArrowRight />}
            </button>
          </div>
        </fieldset>
      </form>

      <section className={styles.quickNote}>
        <h2 className={styles.quickTitle}>{f.quickTitle}</h2>
        <p className="soft">{f.quickText}</p>
        <Link href={`/${lang}/porondam/stars`} className={styles.starsLink}>
          {t.stars.formLink}
          <ArrowRight />
        </Link>
      </section>
    </main>
  );
}
