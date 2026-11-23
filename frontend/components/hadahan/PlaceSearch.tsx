"use client";

import { useEffect, useId, useRef, useState } from "react";

import { type Place, fill, searchPlaces } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import styles from "./BirthForm.module.css";

type Props = {
  lang: Locale;
  label: string;
  hint: string;
  empty: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  /** Shown in the empty box: the place used when none is chosen, such as Colombo. */
  placeholder?: string;
  /** Takes the hint's place once a place is chosen: "Chosen: {place} ({timezone})". */
  chosen?: string;
  /** The input's id, for a form that takes the visitor to it. */
  inputId?: string;
  /** Marks the input as still needed. */
  invalid?: boolean;
};

export function placeLabel(place: Place, lang: Locale): string {
  const name = lang === "si" && place.name_si ? place.name_si : place.name;
  const region = lang === "si" ? (place.region_si ?? place.region) : place.region;
  const country = lang === "si" ? (place.country_name_si ?? place.country_name) : place.country_name;
  return [name, region, country].filter(Boolean).join(", ");
}

/**
 * Labels for a list of places that never repeat: where two read the same, the time zone is
 * added, then the coordinates (QA report AST-07). Screen readers hear the same text.
 */
export function distinctLabels(places: Place[], lang: Locale): string[] {
  const count = (labels: string[]) =>
    labels.reduce((seen, label) => seen.set(label, (seen.get(label) ?? 0) + 1), new Map<string, number>());
  let labels = places.map((place) => placeLabel(place, lang));
  let seen = count(labels);
  labels = labels.map((label, i) => ((seen.get(label) ?? 0) > 1 ? `${label} · ${places[i].timezone}` : label));
  seen = count(labels);
  return labels.map((label, i) => {
    if ((seen.get(label) ?? 0) <= 1) return label;
    const { latitude, longitude } = places[i];
    return `${label} · ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  });
}

export function PlaceSearch({
  lang,
  label,
  hint,
  empty,
  value,
  onChange,
  placeholder,
  chosen,
  inputId,
  invalid,
}: Props) {
  const ownId = useId();
  const id = inputId ?? ownId;
  const listId = `${id}-list`;
  const [query, setQuery] = useState(value ? placeLabel(value, lang) : "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState(false);
  // A place that is already chosen needs no search until its text changes.
  const skipNext = useRef(value !== null);
  const labels = distinctLabels(results, lang);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const text = query.trim();
    if (text.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(text, controller.signal)
        .then((found) => {
          setResults(found);
          setActive(found.length ? 0 : -1);
          setSearched(true);
          setOpen(true);
        })
        .catch(() => undefined);
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function choose(place: Place) {
    skipNext.current = true;
    setQuery(placeLabel(place, lang));
    setOpen(false);
    onChange(place);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showEmpty = open && searched && results.length === 0;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.searchWrap}>
        <svg aria-hidden="true" className={styles.searchIcon} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="9" cy="9" r="6" />
          <path d="M13.5 13.5L18 18" />
        </svg>
        <input
          id={id}
          className={`${styles.input} ${styles.searchInput}`}
          type="text"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby={`${id}-hint`}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearched(false);
            if (event.target.value.trim().length < 2) {
              setResults([]);
              setOpen(false);
            }
            if (value) onChange(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onFocus={() => results.length > 0 && !value && setOpen(true)}
        />
      </div>
      <p id={`${id}-hint`} className={value && chosen ? styles.hintDone : styles.hint} data-place-hint>
        {value && chosen ? fill(chosen, { place: placeLabel(value, lang), timezone: value.timezone }) : hint}
      </p>
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className={styles.options}>
          {results.map((place, index) => (
            <li
              key={place.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? styles.optionActive : styles.option}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(place);
              }}
            >
              <span>{lang === "si" && place.name_si ? place.name_si : place.name}</span>
              <span className={styles.optionMeta}>
                {labels[index].split(", ").slice(1).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
      {showEmpty && (
        <p className={styles.hint} role="status">
          {empty}
        </p>
      )}
    </div>
  );
}
