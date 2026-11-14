"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { ArrowRight, Lock } from "@/components/Icons";
import {
  type BirthRequest,
  EMPTY_FORM,
  type FormValues,
  fill,
  resolveTime,
} from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { useHydrated } from "@/lib/useHydrated";

import styles from "./BirthForm.module.css";
import { PlaceSearch, placeLabel } from "./PlaceSearch";

export { EMPTY_FORM, type FormValues };

/** Changing any of these makes an earlier clock-change choice meaningless. */
const WHEN_AND_WHERE: ReadonlySet<keyof FormValues> = new Set([
  "date",
  "time",
  "place",
  "manual",
  "latitude",
  "longitude",
  "timezone",
]);

type Props = {
  lang: Locale;
  t: Dictionary["hadahan"];
  initial: FormValues;
  busy: boolean;
  error: string | null;
  onSubmit: (
    request: BirthRequest,
    values: FormValues,
    placeText: string,
  ) => void;
  /** Shown inside another page: no page wrapper or side panel, and its own heading. */
  embedded?: { title: string; lead: string; submit: string; working: string };
  /** Text for the link to the old horoscope search, shown in the side panel. */
  kendara?: Dictionary["kendara"];
  /** A line above the fields, such as where the values came from. */
  notice?: string;
  /** Called as the values change, so a page can keep a draft. */
  onChange?: (values: FormValues) => void;
};

export type FieldProblem = "latitude" | "longitude" | "timezone";

/** The time zone in its standard spelling, or null when it is not a real zone name. */
export function canonicalTimezone(name: string): string | null {
  const text = name.trim();
  if (!text) return null;
  try {
    return new Intl.DateTimeFormat("en", { timeZone: text }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

const inRange = (text: string, limit: number) => {
  const value = Number(text);
  return text.trim() !== "" && Number.isFinite(value) && Math.abs(value) <= limit;
};

/**
 * Typed coordinates or time zone that cannot work, so each can be named beside its field
 * instead of one generic failure after submitting (QA report AST-06). Empty fields are not
 * problems here: the form asks for missing details separately.
 */
export function fieldProblems(values: FormValues): FieldProblem[] {
  if (!values.manual) return [];
  const problems: FieldProblem[] = [];
  if (values.latitude.trim() && !inRange(values.latitude, 90)) problems.push("latitude");
  if (values.longitude.trim() && !inRange(values.longitude, 180)) problems.push("longitude");
  if (values.timezone.trim() && !canonicalTimezone(values.timezone)) problems.push("timezone");
  return problems;
}

export function toRequest(values: FormValues): BirthRequest | null {
  if (!values.date || !values.time) return null;
  const fold = values.fold === undefined ? {} : { fold: values.fold };
  if (values.manual) {
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    const timezone = canonicalTimezone(values.timezone);
    if (!values.latitude || !values.longitude || !timezone) return null;
    if (fieldProblems(values).length > 0) return null;
    return {
      date: values.date,
      time: values.time,
      latitude,
      longitude,
      timezone,
      ...fold,
    };
  }
  if (!values.place) return null;
  return { date: values.date, time: values.time, place_id: values.place.id, ...fold };
}

export function BirthForm({
  lang,
  t,
  initial,
  busy,
  error,
  onSubmit,
  embedded,
  kendara,
  notice,
  onChange,
}: Props) {
  const hydrated = useHydrated();
  // Unique per form, so two forms on a page (or a page kept alive after navigation)
  // never share an id and a label never names the wrong field (QA report AST-08).
  const uid = useId();
  const ids = {
    name: `${uid}-name`,
    date: `${uid}-date`,
    time: `${uid}-time`,
    lat: `${uid}-lat`,
    lon: `${uid}-lon`,
    tz: `${uid}-tz`,
    tzHint: `${uid}-tz-hint`,
  };
  const problemIds: Record<FieldProblem, string> = {
    latitude: `${uid}-lat-error`,
    longitude: `${uid}-lon-error`,
    timezone: `${uid}-tz-error`,
  };
  const fieldIds: Record<FieldProblem, string> = { latitude: ids.lat, longitude: ids.lon, timezone: ids.tz };
  const [values, setValues] = useState<FormValues>(initial);
  const [unknownTime, setUnknownTime] = useState(false);
  const [offset, setOffset] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  // Field problems show once the visitor has tried to submit, then update as they type.
  const [checked, setChecked] = useState(false);
  const f = t.form;

  const request = toRequest(values);
  const problems = checked ? fieldProblems(values) : [];
  const problem = (field: FieldProblem) =>
    problems.includes(field) ? (
      <p id={problemIds[field]} className={styles.fieldError}>
        {t.errors[field]}
      </p>
    ) : null;
  const requestKey = request ? JSON.stringify(request) : "";

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();
    resolveTime(JSON.parse(requestKey) as BirthRequest, controller.signal)
      .then((result) => setOffset(result.offset_label ?? null))
      .catch(() => setOffset(null));
    return () => controller.abort();
  }, [requestKey]);

  useEffect(() => {
    onChange?.(values);
  }, [values, onChange]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (WHEN_AND_WHERE.has(key)) delete next.fold;
      return next;
    });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setChecked(true);
    const found = fieldProblems(values);
    if (found.length > 0) {
      setMissing(false);
      // Take the visitor to the first field to fix; its message is read with it.
      document.getElementById(fieldIds[found[0]])?.focus();
      return;
    }
    const ready = toRequest(values);
    if (!ready) {
      setMissing(true);
      return;
    }
    setMissing(false);
    const placeText = values.manual
      ? `${values.latitude}, ${values.longitude}`
      : values.place
        ? placeLabel(values.place, lang)
        : "";
    onSubmit(ready, values, placeText);
  }

  const Heading = embedded ? "h2" : "h1";
  const form = (
    <form className={`rise ${styles.card}`} onSubmit={submit} noValidate>
      <fieldset className="form-lock" disabled={!hydrated}>
        <div className={styles.head}>
          {!embedded && (
            <span className={`sinhala ${styles.eyebrow}`}>{f.eyebrow}</span>
          )}
          <Heading className={`display ${styles.title}`}>
            {embedded?.title ?? f.title}
          </Heading>
          <p className="soft">{embedded?.lead ?? f.lead}</p>
        </div>
        {notice && (
          <p className={styles.note} data-notice>
            {notice}
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor={ids.name} className={styles.label}>
            {f.name}
          </label>
          <input
            id={ids.name}
            className={styles.input}
            type="text"
            autoComplete="off"
            maxLength={60}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>

        <div className={styles.pair}>
          <div className={styles.field}>
            <label htmlFor={ids.date} className={styles.label}>
              {f.date}
            </label>
            <input
              id={ids.date}
              className={styles.input}
              type="date"
              min="1800-01-01"
              max="2200-12-31"
              required
              value={values.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={ids.time} className={styles.label}>
              {f.time}
            </label>
            <input
              id={ids.time}
              className={styles.input}
              type="time"
              required
              disabled={unknownTime}
              value={values.time}
              onChange={(e) => set("time", e.target.value)}
            />
          </div>
        </div>

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={unknownTime}
            onChange={(e) => setUnknownTime(e.target.checked)}
          />
          {f.unknownTime}
        </label>
        {unknownTime && (
          <p className={styles.note} role="status">
            {f.unknownTimeNote}
          </p>
        )}

        {values.manual ? (
          <div className={styles.manual}>
            <div className={styles.pair}>
              <div className={styles.field}>
                <label htmlFor={ids.lat} className={styles.label}>
                  {f.latitude}
                </label>
                <input
                  id={ids.lat}
                  className={styles.input}
                  inputMode="decimal"
                  placeholder="7.2906"
                  aria-invalid={problems.includes("latitude") || undefined}
                  aria-describedby={problems.includes("latitude") ? problemIds.latitude : undefined}
                  value={values.latitude}
                  onChange={(e) => set("latitude", e.target.value)}
                />
                {problem("latitude")}
              </div>
              <div className={styles.field}>
                <label htmlFor={ids.lon} className={styles.label}>
                  {f.longitude}
                </label>
                <input
                  id={ids.lon}
                  className={styles.input}
                  inputMode="decimal"
                  placeholder="80.6336"
                  aria-invalid={problems.includes("longitude") || undefined}
                  aria-describedby={problems.includes("longitude") ? problemIds.longitude : undefined}
                  value={values.longitude}
                  onChange={(e) => set("longitude", e.target.value)}
                />
                {problem("longitude")}
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor={ids.tz} className={styles.label}>
                {f.timezone}
              </label>
              <input
                id={ids.tz}
                className={styles.input}
                autoComplete="off"
                placeholder="Asia/Colombo"
                aria-describedby={problems.includes("timezone") ? `${problemIds.timezone} ${ids.tzHint}` : ids.tzHint}
                aria-invalid={problems.includes("timezone") || undefined}
                value={values.timezone}
                onChange={(e) => set("timezone", e.target.value)}
              />
              {problem("timezone")}
              <p id={ids.tzHint} className={styles.hint}>
                {f.timezoneHint}
              </p>
            </div>
          </div>
        ) : (
          <PlaceSearch
            lang={lang}
            label={f.place}
            hint={f.placeHint}
            empty={f.noPlaces}
            value={values.place}
            onChange={(place) => set("place", place)}
          />
        )}

        <div className={styles.placeFooter}>
          <span className="soft" aria-live="polite">
            {request && offset ? fill(f.timezoneOnDate, { offset }) : ""}
          </span>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => set("manual", !values.manual)}
          >
            {values.manual ? f.usePlace : f.coordinates}
          </button>
        </div>

        {(missing || error) && (
          <p className={styles.error} role="alert">
            {missing ? t.errors.missing : error}
          </p>
        )}

        <button
          type="submit"
          className={`btn btn-primary lift ${styles.submit}`}
          disabled={busy || unknownTime}
        >
          {busy
            ? (embedded?.working ?? f.working)
            : (embedded?.submit ?? f.submit)}
          {!busy && <ArrowRight />}
        </button>
      </fieldset>
    </form>
  );

  if (embedded) return form;

  return (
    <main id="main" className={`container ${styles.page}`}>
      {form}

      <aside
        className={`rise ${styles.aside}`}
        style={{ animationDelay: ".15s" }}
      >
        <div className={styles.moonWrap}>
          <svg aria-hidden="true" viewBox="0 0 320 320" className={styles.halo}>
            <circle
              cx="160"
              cy="160"
              r="150"
              fill="none"
              stroke="var(--gold)"
              strokeOpacity=".5"
              strokeWidth="1.4"
              strokeDasharray="2 12"
            />
            <circle
              cx="160"
              cy="160"
              r="118"
              fill="none"
              stroke="var(--line)"
            />
          </svg>
          <Image
            src="/images/moon.png"
            alt={f.moonAlt}
            width={322}
            height={323}
            className={styles.moon}
            priority
          />
        </div>
        <ul className={styles.tips}>
          <li>
            <strong>{f.tipTimeTitle}</strong> {f.tipTime}
          </li>
          <li>
            <Lock size={16} /> <strong>{f.tipPrivacyTitle}</strong>{" "}
            {f.tipPrivacy}
          </li>
          {kendara && (
            <li>
              <strong>{kendara.link}</strong>{" "}
              <Link href={`/${lang}/kendara`}>{kendara.linkAction}</Link>
            </li>
          )}
        </ul>
      </aside>
    </main>
  );
}
