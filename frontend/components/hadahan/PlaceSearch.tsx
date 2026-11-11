"use client";

import { useEffect, useId, useRef, useState } from "react";

import { type Place, searchPlaces } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import styles from "./BirthForm.module.css";

type Props = {
  lang: Locale;
  label: string;
  hint: string;
  empty: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
};

export function placeLabel(place: Place, lang: Locale): string {
  const name = lang === "si" && place.name_si ? place.name_si : place.name;
  const region = lang === "si" ? (place.region_si ?? place.region) : place.region;
  const country = lang === "si" ? (place.country_name_si ?? place.country_name) : place.country_name;
  return [name, region, country].filter(Boolean).join(", ");
}

export function PlaceSearch({ lang, label, hint, empty, value, onChange }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState(value ? placeLabel(value, lang) : "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState(false);
  const skipNext = useRef(false);

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
          autoComplete="off"
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
      <p id={`${id}-hint`} className={styles.hint}>
        {hint}
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
                {placeLabel(place, lang).split(", ").slice(1).join(", ")}
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
