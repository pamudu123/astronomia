"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { ArrowRight } from "@/components/Icons";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { padaRange, starSigns } from "@/lib/nakshatra";
import { ringOffset } from "@/lib/porondam";
import {
  type Role,
  type StarMatch,
  type StarMatches as Data,
  fetchStarMatches,
  quickMatchHref,
} from "@/lib/starmatch";
import { useHydrated } from "@/lib/useHydrated";

import toggles from "./Porondam.module.css";
import styles from "./StarMatches.module.css";

const RING = 2 * Math.PI * 20;

type Props = {
  lang: Locale;
  t: Dictionary["porondam"]["stars"];
  star: string;
  starName: string;
  /** Sign names for the Moon sign choice, by key. */
  rashiNames: Record<string, string>;
  /** The list for pada 1 as the bride, when the server could reach the backend. */
  initial: Data | null;
};

type State = { data: Data | null; failed: boolean };

export function StarMatches({ lang, t, star, starName, rashiNames, initial }: Props) {
  const hydrated = useHydrated();
  const signs = starSigns(star);
  const [pada, setPada] = useState(1);
  const [role, setRole] = useState<Role>("bride");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ data: initial, failed: false });

  const current =
    state.data && state.data.pada === pada && state.data.role === role ? state.data : null;

  useEffect(() => {
    if (current) return;
    let stale = false;
    fetchStarMatches(star, pada, role, lang)
      .then((data) => !stale && setState({ data, failed: false }))
      .catch(() => !stale && setState((previous) => ({ ...previous, failed: true })));
    return () => {
      stale = true;
    };
  }, [star, pada, role, lang, attempt, current]);

  function choose(nextPada: number, nextRole: Role) {
    setState((previous) => ({ ...previous, failed: false }));
    setPada(nextPada);
    setRole(nextRole);
  }

  const row = (match: StarMatch) => (
    <li
      key={`${match.nakshatra}-${match.rashi}`}
      className={styles.row}
      data-star={match.nakshatra}
      data-rashi={match.rashi}
    >
      <svg
        viewBox="0 0 48 48"
        className={styles.ring}
        role="img"
        aria-label={fill(t.score, { passed: match.score.passed, total: match.score.total })}
      >
        <circle cx="24" cy="24" r="20" className={styles.track} />
        <circle
          cx="24"
          cy="24"
          r="20"
          className={match.essential_pass ? styles.fill : styles.fillPoor}
          strokeDasharray={RING}
          strokeDashoffset={ringOffset(match.score.passed, match.score.total, RING)}
          transform="rotate(-90 24 24)"
        />
        <text x="24" y="24" className={styles.ringNumber}>
          {match.score.passed}/{match.score.total}
        </text>
      </svg>
      <div className={styles.who}>
        <span className={styles.name}>
          {fill(t.partner, { star: match.name, rashi: match.rashi_name })}
        </span>
        <span className={styles.small}>
          {match.padas.length < 4 && fill(t.padas, { padas: padaRange(match.padas) })}
          {match.padas.length < 4 && match.same_star && " · "}
          {match.same_star && t.sameStar}
        </span>
      </div>
      <ul className={styles.checks}>
        {match.hard_checks.map((check) => (
          <li
            key={check.id}
            className={check.passed ? styles.checkPass : styles.checkFail}
            data-check={check.id}
          >
            {check.name} <span>{check.passed ? t.pass : t.fail}</span>
          </li>
        ))}
      </ul>
      <Link
        className={styles.open}
        href={quickMatchHref(lang, { star, pada }, { star: match.nakshatra, pada: match.padas[0] }, role)}
      >
        {t.open}
        <ArrowRight />
      </Link>
    </li>
  );

  const good = current?.matches.filter((match) => match.essential_pass) ?? [];
  const poor = current?.matches.filter((match) => !match.essential_pass) ?? [];

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <div className={styles.control}>
          <span className={styles.controlLabel} id="star-role">
            {t.role}
          </span>
          <div role="group" aria-labelledby="star-role" className={toggles.toggle}>
            {(["bride", "groom"] as const).map((value) => (
              <button
                key={value}
                type="button"
                disabled={!hydrated}
                aria-pressed={role === value}
                className={role === value ? toggles.toggleGold : toggles.toggleOff}
                onClick={() => choose(pada, value)}
              >
                {value === "bride" ? t.bride : t.groom}
              </button>
            ))}
          </div>
          <span className={styles.small}>{t.roleNote}</span>
        </div>
        {signs.length > 1 && (
          <div className={styles.control}>
            <span className={styles.controlLabel} id="star-sign">
              {t.sign}
            </span>
            <div role="group" aria-labelledby="star-sign" className={toggles.toggle}>
              {signs.map((sign) => {
                const on = sign.padas.includes(pada);
                return (
                  <button
                    key={sign.rashi}
                    type="button"
                    disabled={!hydrated}
                    aria-pressed={on}
                    className={on ? toggles.toggleGold : toggles.toggleOff}
                    onClick={() => choose(sign.padas[0], role)}
                  >
                    {fill(t.signOption, {
                      rashi: rashiNames[sign.rashi] ?? sign.rashi,
                      padas: padaRange(sign.padas),
                    })}
                  </button>
                );
              })}
            </div>
            <span className={styles.small}>{fill(t.signNote, { star: starName })}</span>
          </div>
        )}
      </div>

      {!current && state.failed && (
        <div className={styles.status} role="alert">
          <p>{t.failed}</p>
          <button
            type="button"
            className="btn btn-outline lift"
            onClick={() => {
              setState((previous) => ({ ...previous, failed: false }));
              setAttempt((count) => count + 1);
            }}
          >
            {t.retry}
          </button>
        </div>
      )}
      {!current && !state.failed && (
        <p className={styles.status} role="status">
          {t.loading}
        </p>
      )}

      {current && (
        <>
          <section className={styles.group} aria-labelledby="stars-good">
            <h2 id="stars-good" className={`display ${styles.groupTitle}`}>
              {t.good}
            </h2>
            {good.length > 0 ? (
              <ol className={styles.list}>{good.map(row)}</ol>
            ) : (
              <p className="soft">{t.none}</p>
            )}
          </section>
          {poor.length > 0 && (
            <section className={styles.group} aria-labelledby="stars-poor">
              <h2 id="stars-poor" className={`display ${styles.groupTitle}`}>
                {t.poor}
              </h2>
              <p className="soft">{t.poorLead}</p>
              <ol className={styles.list}>{poor.map(row)}</ol>
            </section>
          )}
          <p className={styles.note}>
            {current.provisional && `${t.provisional} `}
            {fill(t.method, { rules: current.rule_set })}
          </p>
        </>
      )}
    </div>
  );
}
