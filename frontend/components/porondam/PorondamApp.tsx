"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import {
  EMPTY_FORM,
  fieldProblems,
  missingFields,
  toRequest,
} from "@/components/hadahan/BirthForm";
import formStyles from "@/components/hadahan/BirthForm.module.css";
import { ArrowRight } from "@/components/Icons";
import { fill, loadSession, saveSession } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { holdInView } from "@/lib/holdInView";
import { useHydrated } from "@/lib/useHydrated";
import { useLabels } from "@/lib/useLabels";
import {
  EMPTY_MATCH,
  type LinkedStars,
  type MatchForm,
  PORONDAM_KEY,
  type PersonInput,
  type Porondam,
  type PorondamRequest,
  type Role,
  type SavedMatch,
  fetchPorondam,
  keepsMatch,
  linkOf,
  loadMatchDraft,
  openingForm,
  saveMatchDraft,
} from "@/lib/porondam";
import { type Handoff, clearHandoff, handoffSnapshot, parseHandoff } from "@/lib/kendara";
import { parseStarParam } from "@/lib/starmatch";

import { NAKSHATRA_ORDER, PersonCard, type PersonField, fieldId } from "./PersonCard";
import styles from "./Porondam.module.css";
import { PorondamResult } from "./PorondamResult";

const ROLES: readonly Role[] = ["bride", "groom"];
const CONSENT_ID = "match-consent";

type View =
  | { kind: "form" }
  | { kind: "choice"; request: PorondamRequest; result: Porondam }
  | { kind: "result"; saved: SavedMatch };

const noChanges = () => () => undefined;

/**
 * A link from the star pages names two stars (?bride=anuradha.2&groom=rohini.1). The form
 * then opens on the quick match with them filled in. The query is read after the page is
 * live, so the server HTML and the first browser render agree. ?mode=stars (from the chart form,
 * when the birth time is not known) opens the quick match with nothing filled in.
 */
export function PorondamApp(props: { lang: Locale; dict: Dictionary }) {
  const search = useSyncExternalStore(
    noChanges,
    () => window.location.search,
    () => "",
  );
  const linked = useMemo<LinkedStars | null>(() => {
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
  const starsFirst = new URLSearchParams(search).get("mode") === "stars";
  const forWedding = new URLSearchParams(search).get("for") === "wedding";
  return (
    <PorondamForm
      key={`${search}|${handoff ? raw : ""}`}
      {...props}
      linked={linked}
      link={linkOf(linked, starsFirst)}
      handoff={handoff}
      forWedding={forWedding}
    />
  );
}

/** The form with a birth sent from the old horoscope search put in, for the bride or the groom. */
function withHandoff(form: MatchForm, handoff: Handoff | null): MatchForm {
  if (!handoff?.role) return form;
  const { role, date, time, place } = handoff;
  return { ...form, mode: "full", full: { ...form.full, [role]: { ...EMPTY_FORM, date, time, place } } };
}

function PorondamForm({
  lang,
  dict,
  linked,
  link,
  handoff,
  forWedding,
}: {
  lang: Locale;
  dict: Dictionary;
  linked: LinkedStars | null;
  /** What the address asked for, as one text. */
  link: string;
  handoff: Handoff | null;
  /** The match, once on screen, opens on the wedding dates search. */
  forWedding: boolean;
}) {
  const t = dict.porondam;
  const hydrated = useHydrated();
  const { labels, failed, retry } = useLabels(lang);
  const [form, setForm] = useState<MatchForm>(EMPTY_MATCH);
  const { mode, full, quick } = form;
  const [filled, setFilled] = useState<Role | null>(handoff?.role ?? null);
  // Bumped to draw the people again from restored values: a place box keeps its own text.
  const [formKey, setFormKey] = useState(0);
  // The draft is read once the page is live, and only written after that, so the form's first
  // empty values never wipe it.
  const [draftRead, setDraftRead] = useState(false);
  if (hydrated && !draftRead) {
    setDraftRead(true);
    setForm(withHandoff(openingForm(loadMatchDraft(), link, linked), handoff));
    setFormKey((key) => key + 1);
  }
  const [view, setView] = useState<View>({ kind: "form" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What is still needed shows once the visitor has tried to match, then updates as they type.
  const [checked, setChecked] = useState(false);
  // Both adults agreed to a match from their full birth details (docs/09). Asked each time.
  const [agreed, setAgreed] = useState(false);

  // The page is kept alive behind another one, such as the same page in the other language.
  // Shown again, it takes up what was typed there. Before the draft is written, below.
  const shown = useRef(false);
  useEffect(() => {
    const again = shown.current;
    shown.current = true;
    if (!again || filled) return;
    const draft = loadMatchDraft();
    if (!draft || draft.link !== link) return;
    const timer = setTimeout(() => {
      setForm(openingForm(draft, link, null));
      setFormKey((key) => key + 1);
    });
    return () => clearTimeout(timer);
    // Only when the page is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A birth sent from the old horoscope search is for one use only, so it is not kept.
  const drafting = draftRead && !filled && view.kind !== "result";
  useEffect(() => {
    if (drafting) saveMatchDraft({ ...form, link });
  }, [drafting, form, link]);

  // Bring back the last match in this tab, in the current language. A link from the star
  // pages asks for a new match, so it wins, unless it is the link this match was made from.
  const fresh = Boolean(handoff);
  useEffect(() => {
    if (fresh) return;
    const saved = loadSession<SavedMatch>(PORONDAM_KEY);
    if (!saved || !keepsMatch(saved, link)) return;
    fetchPorondam(saved.request, lang)
      .then((result) => {
        if (result.status === "ok")
          setView({ kind: "result", saved: { ...saved, result } });
      })
      .catch((caught: { status?: number }) => {
        // Refused: these details no longer work. Otherwise the service is only not answering
        // (it may be waking), so the match stays, and shows as it was in the same language.
        if (caught.status === 404 || caught.status === 422) saveSession(PORONDAM_KEY, null);
        else if (saved.lang === lang) setView({ kind: "result", saved });
      });
  }, [lang, fresh, link]);

  const missing = (role: Role): PersonField[] =>
    mode === "quick" ? (quick[role].nakshatra ? [] : ["star"]) : missingFields(full[role]);
  const fieldName = (field: PersonField) => (field === "star" ? t.form.star : dict.hadahan.form[field]);
  const future = (role: Role) => mode === "full" && fieldProblems(full[role]).includes("date");
  const needsConsent = mode === "full" && !agreed;
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
        const saved: SavedMatch = { request, result, link, lang, form };
        saveSession(PORONDAM_KEY, saved);
        saveMatchDraft(null);
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
    const late = ROLES.find(future);
    if (!bride || !groom || late || needsConsent) {
      setError(null);
      // Take the visitor to the first detail still needed, or wrong, then to the confirmation.
      const role = ROLES.find((one) => missing(one).length > 0);
      const target = role ? fieldId(role, missing(role)[0]) : late ? fieldId(late, "date") : CONSENT_ID;
      document.getElementById(target)?.focus();
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
          // The details come back, also after a reload, so one of them can be changed.
          if (view.saved.form) setForm(view.saved.form);
          setFormKey((key) => key + 1);
          setChecked(false);
          setAgreed(false);
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
            onClick={() => setForm((current) => ({ ...current, mode: value }))}
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
          <div className={styles.people} key={formKey}>
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
                  dateError={checked && future(role) ? dict.hadahan.errors.date : undefined}
                  onFull={(update) =>
                    setForm((current) => ({
                      ...current,
                      full: { ...current.full, [role]: update(current.full[role]) },
                    }))
                  }
                  onQuick={(update) =>
                    setForm((current) => ({
                      ...current,
                      quick: { ...current.quick, [role]: update(current.quick[role]) },
                    }))
                  }
                />
              </div>
            ))}
          </div>

          {mode === "full" && (
            <div className={formStyles.consent} data-consent>
              <label className={formStyles.check}>
                <input
                  id={CONSENT_ID}
                  type="checkbox"
                  required
                  checked={agreed}
                  aria-invalid={(checked && needsConsent) || undefined}
                  aria-describedby={
                    checked && needsConsent ? `${CONSENT_ID}-error ${CONSENT_ID}-other` : `${CONSENT_ID}-other`
                  }
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                {f.consent}
              </label>
              {checked && needsConsent && (
                <p id={`${CONSENT_ID}-error`} className={formStyles.fieldError}>
                  {f.consentNeeded}
                </p>
              )}
              <div className={formStyles.hintRow}>
                <span id={`${CONSENT_ID}-other`} className={formStyles.hint}>
                  {f.consentOther}
                </span>
                <button
                  type="button"
                  className={formStyles.linkButton}
                  onClick={() => {
                    setForm((current) => ({ ...current, mode: "quick" }));
                    // This button goes with the full details, so stay with the choice it made.
                    document.querySelector<HTMLElement>('[data-mode="quick"]')?.focus();
                  }}
                >
                  {f.consentSwitch}
                </button>
              </div>
            </div>
          )}

          {failed && (
            <p className={formStyles.error} role="alert">
              {dict.hadahan.errors.loading}{" "}
              <button type="button" className={formStyles.linkButton} onClick={retry}>
                {dict.hadahan.errors.retry}
              </button>
            </p>
          )}

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
