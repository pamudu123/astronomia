"use client";

import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { PlaceSearch } from "@/components/hadahan/PlaceSearch";
import { type Place, fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import {
  type Avurudu,
  type AvuruduItem,
  type BothTimes,
  SRI_LANKA,
  browserTimezone,
  fetchAvurudu,
} from "@/lib/nakath";
import { useHydrated } from "@/lib/useHydrated";

import styles from "./Nakath.module.css";
import { dayText, localDate } from "./format";

type Props = {
  lang: Locale;
  t: Dictionary["avurudu"];
  year: number;
  /** The time zone the server rendered: Sri Lanka, or a city's. */
  zone: string;
  /** A city page keeps its time zone; the year page follows the visitor's. */
  fixed: boolean;
  initial: Avurudu | null;
};

function Clock({ label, time, lang }: { label: string; time: BothTimes["local"]; lang: Locale }) {
  return (
    <div className={styles.time}>
      <span className={styles.timeLabel}>{label}</span>
      <span className={styles.clock}>{time.clock}</span>
      <span className={styles.clockDate}>{localDate(time, lang)}</span>
    </div>
  );
}

/** Sri Lanka time, and the visitor's own time when it differs. */
function Times({
  both,
  t,
  lang,
  zone,
}: {
  both: BothTimes;
  t: Dictionary["avurudu"];
  lang: Locale;
  zone: string;
}) {
  return (
    <div className={styles.times}>
      <Clock label={t.sriLanka} time={both.sri_lanka} lang={lang} />
      {zone !== SRI_LANKA && <Clock label={fill(t.yourTimeIn, { zone })} time={both.local} lang={lang} />}
    </div>
  );
}

function difference(t: Dictionary["avurudu"], minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return null;
  if (minutes === 0) return t.same;
  return fill(minutes > 0 ? t.later : t.earlier, { minutes: Math.abs(minutes) });
}

export function AvuruduView({ lang, t, year, zone: initialZone, fixed, initial }: Props) {
  const hydrated = useHydrated();
  const [zone, setZone] = useState(initialZone);
  const [data, setData] = useState<Avurudu | null>(initial);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);

  // On the year page, show the visitor's own time next to Sri Lanka time.
  const browser = hydrated ? browserTimezone() : null;
  const wanted = !fixed && zone === SRI_LANKA && browser && browser !== SRI_LANKA ? browser : zone;

  const current = data && data.timezone === wanted && data.year === year ? data : null;

  useEffect(() => {
    if (current) return;
    let stale = false;
    fetchAvurudu(year, wanted, lang)
      .then((result) => !stale && setData(result))
      .catch(() => !stale && setFailed(true));
    return () => {
      stale = true;
    };
  }, [current, year, wanted, lang, attempt]);

  const shown = current ?? data;
  if (!shown) {
    return (
      <div className={styles.status} role="status">
        <p>{failed ? t.failed : t.loading}</p>
        {failed && (
          <button
            type="button"
            className="btn btn-outline lift"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            {t.retry}
          </button>
        )}
      </div>
    );
  }

  const shownZone = shown.timezone;
  const isKey = (item: AvuruduItem) => item.key === "dawn" || item.key === "punya_kalaya";

  return (
    <>
      {!fixed && (
        <div className={styles.controls}>
          <div className={styles.control}>
            <PlaceSearch
              lang={lang}
              label={t.choosePlace}
              hint={t.placeHint}
              empty={t.noPlaces}
              value={place}
              onChange={(chosen) => {
                setPlace(chosen);
                if (chosen) setZone(chosen.timezone);
              }}
            />
          </div>
          <p className={styles.small} aria-live="polite">
            {fill(t.showing, { zone: shownZone, offset: shown.offset })}
          </p>
          {browser && browser !== shownZone && (
            <button type="button" className={styles.linkButton} onClick={() => setZone(browser)}>
              {t.useBrowser}
            </button>
          )}
        </div>
      )}

      <span className={shown.official ? styles.badgeGold : styles.badge}>
        {shown.official ? t.official : t.calculated}
      </span>

      {shown.items.length > 0 ? (
        <ul className={styles.items} data-list="official">
          {shown.items.map((item, index) => (
            <li key={`${item.key}-${index}`} className={isKey(item) ? styles.itemKey : styles.item} data-item={item.key}>
              <p className={styles.itemName}>{item.name}</p>
              {item.at && <Times both={item.at} t={t} lang={lang} zone={shownZone} />}
              {item.start && item.end && (
                <>
                  <p className={styles.small}>{t.starts}</p>
                  <Times both={item.start} t={t} lang={lang} zone={shownZone} />
                  <p className={styles.small}>{t.ends}</p>
                  <Times both={item.end} t={t} lang={lang} zone={shownZone} />
                </>
              )}
              {item.date && !item.at && !item.start && <p className={styles.clock}>{dayText(item.date, lang)}</p>}
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.note}>{fill(t.noOfficial, { year })}</p>
      )}

      <section className={styles.section} aria-labelledby="compare-title" data-card="compare">
        <h2 id="compare-title" className={`display ${styles.sectionTitle}`}>
          {shown.official ? t.compareTitle : t.ourTitle}
        </h2>
        <p className="soft">{t.compareLead}</p>
        <div className={styles.compare}>
          <div className={styles.item}>
            <p className={styles.itemName}>{t.ourDawn}</p>
            <Times both={shown.calculated.dawn} t={t} lang={lang} zone={shownZone} />
            {difference(t, shown.calculated.dawn_difference) && (
              <p className={styles.small}>{difference(t, shown.calculated.dawn_difference)}</p>
            )}
          </div>
          <div className={styles.item}>
            <p className={styles.itemName}>{t.ourPunya}</p>
            <p className={styles.small}>{t.starts}</p>
            <Times both={shown.calculated.punya_start} t={t} lang={lang} zone={shownZone} />
            <p className={styles.small}>{t.ends}</p>
            <Times both={shown.calculated.punya_end} t={t} lang={lang} zone={shownZone} />
            {difference(t, shown.calculated.punya_difference) && (
              <p className={styles.small}>{difference(t, shown.calculated.punya_difference)}</p>
            )}
          </div>
        </div>
      </section>

      <div className={styles.note}>
        {shown.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
        <p>{t.abroad}</p>
        {shown.source && <p>{fill(t.source, { source: shown.source })}</p>}
        <p>{t.provisional}</p>
      </div>
    </>
  );
}
