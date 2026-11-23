"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import {
  EMPTY_FORM,
  type FormValues,
  missingFields,
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
import { holdInView } from "@/lib/holdInView";
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
import { type Handoff, clearHandoff, handoffSnapshot, parseHandoff } from "@/lib/kendara";
import { parseStarParam } from "@/lib/starmatch";

import { NAKSHATRA_ORDER, PersonCard, type PersonField, fieldId } from "./PersonCard";
import styles from "./Porondam.module.css";
import { PorondamResult } from "./PorondamResult";

type Role = "bride" | "groom";
const ROLES: readonly Role[] = ["bride", "groom"];
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
  // A birth sent from the old horoscope search, for the bride or the groom.
  const raw = useSyncExternalStore(noChanges, handoffSnapshot, () => "");
  const handoff = linked ? null : parseHandoff(raw, "porondam");
  // Someone who came for wedding dates (?for=wedding, from All tools).
  const forWedding = new URLSearchParams(search).get("for") === "wedding";
  return (
    <PorondamForm
      key={`${search}|${handoff ? raw : ""}`}
      {...props}
      linked={linked}
      handoff={handoff}
      forWedding={forWedding}
    />
  );
}

function filledFrom(handoff: Handoff | null, role: Role): FormValues {
  return handoff?.role === role
    ? { ...EMPTY_FORM, date: handoff.date, time: handoff.time, place: handoff.place }
    : EMPTY_FORM;
}

function PorondamForm({
  lang,
  dict,
  linked,
  handoff,
  forWedding,
}: {
  lang: Locale;
  dict: Dictionary;
  linked: Linked | null;
  handoff: Handoff | null;
  /** The match, once on screen, opens on the wedding dates search. */
  forWedding: boolean;
}) {
  const t = dict.porondam;
  const hydrated = useHydrated();
  const [labels, setLabels] = useState<Labels | null>(null);
  const [mode, setMode] = useState<"full" | "quick">(linked ? "quick" : "full");
  const [full, setFull] = useState<Record<Role, FormValues>>({
    bride: filledFrom(handoff, "bride"),
    groom: filledFrom(handoff, "groom"),
  });
  const [filled, setFilled] = useState<Role | null>(handoff?.role ?? null);
  const [quick, setQuick] = useState<Record<Role, QuickInput>>({
    bride: { ...EMPTY_QUICK, ...linked?.bride },
    groom: { ...EMPTY_QUICK, ...linked?.groom },
  });
  const [view, setView] = useState<View>({ kind: "form" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What is still needed shows once the visitor has tried to match, then updates as they type.
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetchLabels(lang)
      .then(setLabels)
      .catch(() => setError(t.errors.failed));
  }, [lang, t.errors.failed]);

  // Bring back the last match in this tab, in the current language. A link from the star
  // pages asks for a new match, so it wins.
  const fresh = Boolean(linked || handoff);
  useEffect(() => {
    if (fresh) return;
    const saved = loadSession<SavedMatch>(PORONDAM_KEY);
    if (!saved) return;
    fetchPorondam(saved.request, lang)
      .then((result) => {
        if (result.status === "ok")
          setView({ kind: "result", saved: { ...saved, result } });
      })
      .catch(() => saveSession(PORONDAM_KEY, null));
  }, [lang, fresh]);

  const missing = (role: Role): PersonField[] =>
    mode === "quick" ? (quick[role].nakshatra ? [] : ["star"]) : missingFields(full[role]);
  const fieldName = (field: PersonField) => (field === "star" ? t.form.star : dict.hadahan.form[field]);
  const stillNeeded = checked ? ROLES.filter((role) => missing(role).length > 0) : [];

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

  // Take someone who came for wedding dates to the search, once the match is drawn.
  const toWedding = forWedding && view.kind === "result" && labels !== null;
  useEffect(() => {
    if (!toWedding) return;
    const title = document.getElementById("wedding-title");
    if (!title) return;
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
    return holdInView(title);
  }, [toWedding]);

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
    setChecked(true);
    if (!bride || !groom) {
      setError(null);
      // Take the visitor to the first detail still needed.
      const role = ROLES.find((one) => missing(one).length > 0);
      if (role) document.getElementById(fieldId(role, missing(role)[0]))?.focus();
      return;
    }
    clearHandoff();
    setFilled(null);
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
        saveText={dict.saved}
        request={view.saved.request}
        timeline={t.timeline}
        road={{ text: t.road, words: dict.hadahan.result.road }}
        wedding={t.wedding}
        next={dict.next}
        onAgain={() => {
          saveSession(PORONDAM_KEY, null);
          setView({ kind: "form" });
          window.scrollTo({ top: 0 });
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
      </div>

      {forWedding && (
        <p className={`rise ${formStyles.note}`} data-for-wedding>
          {t.weddingFirst}
        </p>
      )}

      {/* Each way of matching says what it compares, before any details are typed. */}
      <div role="group" aria-label={f.mode} className={`rise ${styles.modes}`}>
        {(["full", "quick"] as const).map((value) => (
          <button
            key={value}
            type="button"
            disabled={!hydrated}
            aria-pressed={mode === value}
            className={mode === value ? styles.modeOn : styles.modeOff}
            onClick={() => setMode(value)}
            data-mode={value}
          >
            <span className={styles.modeTitle}>
              <span aria-hidden="true" className={styles.modeDot} />
              {value === "full" ? f.full : f.quick}
            </span>
            <span className={styles.modeText}>{value === "full" ? f.fullText : f.quickText2}</span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className={styles.form}>
        <fieldset className="form-lock" disabled={!hydrated}>
          {filled && mode === "full" && (
            <p className={formStyles.note} data-notice>
              {filled === "bride" ? dict.kendara.handoff.bride : dict.kendara.handoff.groom}
            </p>
          )}
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
                  missing={checked ? missing(role) : []}
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

          {(stillNeeded.length > 0 || error) && (
            <p className={formStyles.error} role="alert">
              {stillNeeded.length > 0
                ? stillNeeded.map((role) => (
                    <span key={role} className={formStyles.errorLine}>
                      {fill(t.errors.missing, {
                        who: t.form[role],
                        fields: missing(role).map(fieldName).join(", "),
                      })}
                    </span>
                  ))
                : error}
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

      {/* The two ways to match already say what each needs, so only the side doors stay here. */}
      <div className={styles.quickNote}>
        <Link href={`/${lang}/porondam/stars`} className={styles.starsLink}>
          {t.stars.formLink}
          <ArrowRight />
        </Link>
        <Link href={`/${lang}/kendara`} className={styles.starsLink}>
          {dict.kendara.linkAction}
          <ArrowRight />
        </Link>
      </div>
    </main>
  );
}
