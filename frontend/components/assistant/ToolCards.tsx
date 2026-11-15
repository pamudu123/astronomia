"use client";

import { useDefaultRenderTool } from "@copilotkit/react-core/v2";
import Link from "next/link";
import { type ReactElement, useCallback } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import {
  type GoodTimes,
  type StarMatches,
  isEngineTool,
  midday,
  parseResult,
  rahuOnDaylight,
  score,
  splitSpan,
  statusKey,
} from "@/lib/assistant/tools";
import { fill, formatDate } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { COLOMBO } from "@/lib/nakath";

import styles from "./ToolCards.module.css";

type Cards = Dictionary["assistant"]["cards"];
type Status = "inProgress" | "executing" | "complete";
type Call = { name: string; parameters: unknown; status: Status; result: string | undefined };

/** How many star matches the card shows; the page has all 27. */
const MATCH_ROWS = 5;

/** A tick or a cross. With a label it is read out; without one it is decoration. */
function Tick({ pass, label }: { pass: boolean; label?: string }) {
  return (
    <svg
      className={pass ? styles.pass : styles.fail}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {label && <title>{label}</title>}
      <path
        d={pass ? "M5 12.5l4.5 4.5L19 7.5" : "M7 7l10 10M17 7L7 17"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A: what the assistant is looking up, then what it checked. */
function StatusLine({ name, status, failed, t }: { name: string; status: Status; failed?: boolean; t: Cards }) {
  const [working, done] = t.status[statusKey(name)];
  if (status !== "complete") {
    return (
      <p className={styles.status} role="status">
        <span className={styles.working} aria-hidden="true" />
        {working}
      </p>
    );
  }
  return (
    <p className={styles.status}>
      <Tick pass={!failed} />
      <span className={failed ? styles.failed : undefined}>{failed ? t.status.failed : done}</span>
    </p>
  );
}

/** "Panchami until 10:15 · Shashti": each part of the day, with the time it ends. */
function Parts({ parts, t }: { parts: GoodTimes["thithi"]; t: Cards }) {
  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part.name}-${index}`} className={styles.part}>
          {part.name}
          {index < parts.length - 1 && part.to && (
            <span className={`${styles.until} ${styles.mono}`}>{fill(t.day.until, { time: part.to })}</span>
          )}
        </span>
      ))}
    </>
  );
}

/** B: the day's times, with Rahu kalaya on a sunrise-to-sunset bar. */
function GoodTimesCard({ day, placeId, lang, t }: { day: GoodTimes; placeId: number; lang: Locale; t: Cards }) {
  const rahu = rahuOnDaylight(day);
  const rahuSpan = splitSpan(day.rahu_kalaya);
  const date = formatDate(`${day.date}T00:00:00Z`, lang);
  return (
    <section className={styles.card} aria-label={fill(t.day.label, { date })}>
      <div className={styles.head}>
        <div>
          <h4 className={styles.title}>
            {day.weekday}, {date}
          </h4>
          <p className={styles.sub}>{day.place}</p>
        </div>
        {day.provisional && <span className={styles.tag}>{t.provisional}</span>}
      </div>
      {rahu && (
        <>
          <div className={styles.bar} aria-hidden="true">
            <div className={styles.rahu} style={{ left: `${rahu.left}%`, width: `${rahu.width}%` }} />
          </div>
          <div className={`${styles.ends} ${styles.mono}`} aria-hidden="true">
            <span>{day.sunrise}</span>
            <span>{midday(day.sunrise, day.sunset)}</span>
            <span>{day.sunset}</span>
          </div>
        </>
      )}
      <dl className={styles.rows}>
        {rahuSpan && (
          <>
            <dt>
              <span className={styles.swatch} aria-hidden="true" />
              {t.day.rahu}
            </dt>
            <dd className={styles.mono}>
              {rahuSpan[0]}–{rahuSpan[1]}
            </dd>
          </>
        )}
        <dt>
          {t.day.sunrise} / {t.day.sunset}
        </dt>
        <dd className={styles.mono}>
          {day.sunrise} / {day.sunset}
        </dd>
        {day.thithi.length > 0 && (
          <>
            <dt>{t.day.thithi}</dt>
            <dd>
              <Parts parts={day.thithi} t={t} />
            </dd>
          </>
        )}
        {day.nakatha.length > 0 && (
          <>
            <dt>{t.day.nakatha}</dt>
            <dd>
              <Parts parts={day.nakatha} t={t} />
            </dd>
          </>
        )}
      </dl>
      {/* The day page shows Colombo, so the link is only offered for a Colombo answer. */}
      {placeId === COLOMBO && (
        <div className={styles.foot}>
          <Link className={styles.link} href={`/${lang}/nakath/${day.date}`}>
            {t.day.open} →
          </Link>
        </div>
      )}
    </section>
  );
}

/** C: the best partner stars, with a score bar and the essential checks for each. */
function StarMatchesCard({ data, star, lang, t }: { data: StarMatches; star: string; lang: Locale; t: Cards }) {
  const rows = data.best_matches.slice(0, MATCH_ROWS);
  const checks = Object.keys(rows[0]?.essential_checks ?? {});
  const title = fill(t.stars.title, { star: data.star, pada: data.pada });
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.head}>
        <div>
          <h4 className={styles.title}>{title}</h4>
          <p className={styles.sub}>{data.sign}</p>
        </div>
        {data.provisional && <span className={styles.tag}>{t.provisional}</span>}
      </div>
      <ol className={styles.matches}>
        {rows.map((match) => {
          const points = score(match.factors_agree);
          const factors = points ? fill(t.stars.factors, points) : match.factors_agree;
          return (
            <li key={match.star_id} className={styles.match}>
              <span className={styles.star}>
                {match.star}
                <small>{match.sign}</small>
              </span>
              <div className={styles.track} role="img" aria-label={factors}>
                {points && <div className={styles.fill} style={{ width: `${(points.agree / points.total) * 100}%` }} />}
              </div>
              <span className={styles.mono} aria-hidden="true">
                {points ? `${points.agree}/${points.total}` : match.factors_agree}
              </span>
              <span className={styles.checks}>
                {Object.entries(match.essential_checks).map(([name, passes]) => (
                  <Tick key={name} pass={passes} label={`${name}: ${passes ? t.stars.passes : t.stars.fails}`} />
                ))}
              </span>
            </li>
          );
        })}
      </ol>
      {checks.length > 0 && <p className={styles.legend}>{fill(t.stars.legend, { checks: checks.join(", ") })}</p>}
      {star && (
        <div className={styles.foot}>
          <Link className={styles.link} href={`/${lang}/porondam/stars/${encodeURIComponent(star)}`}>
            {t.stars.open} →
          </Link>
        </div>
      )}
    </section>
  );
}

function arg(parameters: unknown, key: string): unknown {
  return parameters && typeof parameters === "object" ? (parameters as Record<string, unknown>)[key] : undefined;
}

/** The card or status line for one tool call. */
export function ToolCall({ call, lang, t }: { call: Call; lang: Locale; t: Cards }): ReactElement | null {
  const { name, parameters, status, result } = call;
  const engine = isEngineTool(name);
  // Reading notes and helpers are background work: shown while they run, then gone.
  if (!engine && name !== "task" && status === "complete") return null;
  if (status !== "complete") return <StatusLine name={name} status={status} t={t} />;
  if (name === "good_times_for_day") {
    const day = parseResult<GoodTimes>(result);
    if (day?.date) {
      const placeId = Number(arg(parameters, "place_id") ?? COLOMBO);
      return <GoodTimesCard day={day} placeId={placeId} lang={lang} t={t} />;
    }
  }
  if (name === "find_matching_stars") {
    const data = parseResult<StarMatches>(result);
    if (data?.best_matches?.length) {
      return <StarMatchesCard data={data} star={String(arg(parameters, "star") ?? "")} lang={lang} t={t} />;
    }
  }
  // Tools return their error as plain text, not JSON.
  const failed = engine && parseResult(result) === null;
  return <StatusLine name={name} status={status} failed={failed} t={t} />;
}

/**
 * Draws the agent's tool calls in the chat: a card for the day's times and for star matches,
 * a status line for every other lookup. One wildcard renderer, so a tool added to the agent
 * later gets a status line without a change here.
 */
export function ToolCards({ lang, t }: { lang: Locale; t: Cards }) {
  const render = useCallback((call: Call) => <ToolCall call={call} lang={lang} t={t} />, [lang, t]);
  useDefaultRenderTool({ render }, [render]);
  return null;
}
