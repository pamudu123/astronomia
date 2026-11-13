"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { ArrowRight, Lock } from "@/components/Icons";
import {
  type BirthRequest,
  type Place,
  fill,
  resolveTime,
} from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { useHydrated } from "@/lib/useHydrated";

import styles from "./BirthForm.module.css";
import { PlaceSearch, placeLabel } from "./PlaceSearch";

export type FormValues = {
  name: string;
  date: string;
  time: string;
  place: Place | null;
  manual: boolean;
  latitude: string;
  longitude: string;
  timezone: string;
};

export const EMPTY_FORM: FormValues = {
  name: "",
  date: "",
  time: "",
  place: null,
  manual: false,
  latitude: "",
  longitude: "",
  timezone: "",
};

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
};

export function toRequest(values: FormValues): BirthRequest | null {
  if (!values.date || !values.time) return null;
  if (values.manual) {
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    if (!values.latitude || !values.longitude || !values.timezone.trim())
      return null;
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
    return {
      date: values.date,
      time: values.time,
      latitude,
      longitude,
      timezone: values.timezone.trim(),
    };
  }
  if (!values.place) return null;
  return { date: values.date, time: values.time, place_id: values.place.id };
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
}: Props) {
  const hydrated = useHydrated();
  const [values, setValues] = useState<FormValues>(initial);
  const [unknownTime, setUnknownTime] = useState(false);
  const [offset, setOffset] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const f = t.form;

  const request = toRequest(values);
  const requestKey = request ? JSON.stringify(request) : "";

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();
    resolveTime(JSON.parse(requestKey) as BirthRequest, controller.signal)
      .then((result) => setOffset(result.offset_label ?? null))
      .catch(() => setOffset(null));
    return () => controller.abort();
  }, [requestKey]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
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

        <div className={styles.field}>
          <label htmlFor="birth-name" className={styles.label}>
            {f.name}
          </label>
          <input
            id="birth-name"
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
            <label htmlFor="birth-date" className={styles.label}>
              {f.date}
            </label>
            <input
              id="birth-date"
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
            <label htmlFor="birth-time" className={styles.label}>
              {f.time}
            </label>
            <input
              id="birth-time"
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
                <label htmlFor="birth-lat" className={styles.label}>
                  {f.latitude}
                </label>
                <input
                  id="birth-lat"
                  className={styles.input}
                  inputMode="decimal"
                  placeholder="7.2906"
                  value={values.latitude}
                  onChange={(e) => set("latitude", e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="birth-lon" className={styles.label}>
                  {f.longitude}
                </label>
                <input
                  id="birth-lon"
                  className={styles.input}
                  inputMode="decimal"
                  placeholder="80.6336"
                  value={values.longitude}
                  onChange={(e) => set("longitude", e.target.value)}
                />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="birth-tz" className={styles.label}>
                {f.timezone}
              </label>
              <input
                id="birth-tz"
                className={styles.input}
                autoComplete="off"
                placeholder="Asia/Colombo"
                aria-describedby="birth-tz-hint"
                value={values.timezone}
                onChange={(e) => set("timezone", e.target.value)}
              />
              <p id="birth-tz-hint" className={styles.hint}>
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
