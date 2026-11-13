"use client";

import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { ArrowRight } from "@/components/Icons";
import { KujaDials } from "@/components/KujaDials";
import { ReportButton } from "@/components/ReportButton";
import { ShareButton } from "@/components/ShareButton";
import { type Labels, fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import {
  type Factor,
  type FactorFilter,
  type Person,
  type Porondam,
  type PorondamRequest,
  filterFactors,
  ringOffset,
} from "@/lib/porondam";

import { CoupleTimeline } from "./CoupleTimeline";
import { FactorVisual } from "./FactorVisual";
import styles from "./Porondam.module.css";

const RING = 2 * Math.PI * 84;

type Props = {
  lang: Locale;
  t: Dictionary["porondam"]["result"];
  f: Dictionary["porondam"]["form"];
  labels: Labels;
  result: Porondam;
  /** Share text. Left out on a shared page. */
  share?: Dictionary["share"];
  /** The two people's details. Left out on a shared page: then the result is read only. */
  request?: PorondamRequest;
  /** Text for "Years ahead for the couple". That section needs the request too. */
  timeline?: Dictionary["porondam"]["timeline"];
  onAgain?: () => void;
  /** Shown where the actions are when the result is read only. */
  readOnlyAction?: React.ReactNode;
};

function Check({ ok }: { ok: boolean }) {
  return ok ? (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3 3 7-7.5" />
    </svg>
  ) : (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function PorondamResult({
  lang,
  t,
  f,
  labels,
  result,
  share,
  request,
  timeline,
  onAgain,
  readOnlyAction,
}: Props) {
  const [filter, setFilter] = useState<FactorFilter>("all");
  const match = result.match!;
  const bride = result.bride!;
  const groom = result.groom!;
  const nameOf = (person: Person, fallback: string) => person.name || fallback;
  const factorName = (factor: Factor) => labels.porondam_factor[factor.id];

  const person = (who: Person, fallback: string, tone: string) => (
    <div className={`${styles.who} ${tone}`}>
      <span className={styles.whoName}>{nameOf(who, fallback)}</span>
      <span className="soft">
        {fill(t.star, { star: labels.nakshatra[who.nakshatra], rashi: labels.rashi[who.rashi].name })}
      </span>
      {who.lagna && <span className="soft">{fill(t.lagna, { lagna: labels.rashi[who.lagna].name })}</span>}
    </div>
  );

  return (
    <main id="main" className={`container ${styles.page}`}>
      <section className={`rise ${styles.couple}`}>
        <h1 className={`display ${styles.title}`}>
          {fill(t.title, { bride: nameOf(bride, f.bride), groom: nameOf(groom, f.groom) })}
        </h1>
        <div className={styles.pairRow}>
          {person(bride, f.bride, styles.whoBride)}
          <span aria-hidden="true" className={styles.link}>
            <span />
            <i />
            <span />
          </span>
          {person(groom, f.groom, styles.whoGroom)}
        </div>
      </section>

      <section className={`rise ${styles.summary}`} style={{ animationDelay: ".1s" }}>
        <svg
          className={styles.ring}
          role="img"
          aria-label={fill(t.scoreLabel, { passed: match.score.passed, total: match.score.total })}
          viewBox="0 0 220 220"
        >
          <circle cx="110" cy="110" r="104" className={styles.halo} />
          <circle cx="110" cy="110" r="84" className={styles.track} />
          <circle
            cx="110"
            cy="110"
            r="84"
            className={styles.fill}
            style={
              {
                "--ring": `${RING}`,
                "--offset": `${ringOffset(match.score.passed, match.score.total, RING)}`,
              } as React.CSSProperties
            }
            transform="rotate(-90 110 110)"
          />
          <text x="110" y="104" className={styles.ringNumber}>
            {match.score.passed}
          </text>
          <text x="110" y="146" className={styles.ringText}>
            {fill(t.agree, { total: match.score.total })}
          </text>
        </svg>
        <div className={styles.summaryText}>
          <h2 className={`display ${styles.summaryTitle}`}>{match.summary_text}</h2>
          <p className="soft">{t.guide}</p>
          {match.same_star_text && <p className={styles.note}>{match.same_star_text}</p>}
          <div className={styles.hardGrid}>
            {match.hard_checks.map((check) => (
              <div key={check.id} className={check.passed ? styles.hardPass : styles.hardFail} data-check={check.id}>
                <div className={styles.cardHead}>
                  <span className={styles.factorName}>{factorName(check).name}</span>
                  <span className={check.passed ? styles.pillPass : styles.pillFail}>
                    <Check ok={check.passed} />
                    {check.passed ? t.pass : t.fail}
                  </span>
                </div>
                <span className={styles.small}>
                  {t.essential} · {factorName(check).meaning}
                </span>
                <FactorVisual factor={check} labels={labels} />
                <span className={styles.small}>{check.reason}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.factorsSection} aria-labelledby="factors-title">
        <div className={styles.factorsHead}>
          <div>
            <h2 id="factors-title" className={`display ${styles.sectionTitle}`}>
              {t.factors}
            </h2>
            <p className="soft">{t.factorsLead}</p>
            <p className={styles.legend}>
              <span className="visually-hidden">{t.legend}: </span>
              <span className={styles.legendItem}>
                <i className={styles.legendBride} />
                {nameOf(bride, f.bride)}
              </span>
              <span className={styles.legendItem}>
                <i className={styles.legendGroom} />
                {nameOf(groom, f.groom)}
              </span>
            </p>
          </div>
          <div role="group" aria-label={t.filter} className={styles.toggle}>
            {(
              [
                ["all", t.all],
                ["agree", t.agreeOnly],
                ["disagree", t.disagree],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                className={filter === value ? styles.toggleOn : styles.toggleOff}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className={styles.factorGrid}>
          {filterFactors(match.factors, filter).map((factor, index) => {
            const counted = factor.checked;
            return (
            <li
              key={factor.id}
              className={`rise lift ${!counted ? styles.factorOff : factor.passed ? styles.factor : styles.factorFail}`}
              style={{ animationDelay: `${0.04 * index}s` }}
              data-factor={factor.id}
              data-counted={counted}
            >
              <div className={styles.cardHead}>
                <h3 className={styles.factorName}>{factorName(factor).name}</h3>
                {counted ? (
                  <span className={factor.passed ? styles.pillPass : styles.pillFail}>
                    <Check ok={factor.passed} />
                    {factor.passed ? t.agrees : t.notAgrees}
                  </span>
                ) : (
                  <span className={styles.pillOff}>{t.notCounted}</span>
                )}
              </div>
              <span className={styles.meaning}>{factorName(factor).meaning}</span>
              {counted && <FactorVisual factor={factor} labels={labels} />}
              <p className={styles.small}>{factor.reason}</p>
            </li>
            );
          })}
        </ul>
      </section>

      <section className={`rise ${styles.panel}`} aria-labelledby="kuja-title">
        <h2 id="kuja-title" className={`display ${styles.sectionTitle}`}>
          {t.kuja}
        </h2>
        {result.kuja ? (
          <>
            <div className={styles.kujaGrid}>
              {(
                [
                  [bride, f.bride, result.kuja.bride],
                  [groom, f.groom, result.kuja.groom],
                ] as const
              ).map(([who, fallback, kuja]) => (
                <div key={fallback} className={kuja.present ? styles.kujaYes : styles.kujaNo}>
                  <div className={styles.cardHead}>
                    <span className={styles.factorName}>{nameOf(who, fallback)}</span>
                    <span className={kuja.present ? styles.pillFail : styles.pillPass}>
                      {kuja.present ? t.present : t.absent}
                    </span>
                  </div>
                  <KujaDials kuja={kuja} labels={labels} t={t} compact />
                  <span className={styles.small}>{kuja.reasons[0]}</span>
                </div>
              ))}
            </div>
            <p className="soft">{result.kuja.reason}</p>
          </>
        ) : (
          <p className="soft">{t.kujaQuick}</p>
        )}
      </section>

      {request && timeline && (
        <CoupleTimeline
          lang={lang}
          t={timeline}
          labels={labels}
          request={request}
          brideName={nameOf(bride, f.bride)}
          groomName={nameOf(groom, f.groom)}
        />
      )}

      <section className={styles.footRow}>
        <div className={styles.footText}>
          {match.provisional && <p className={styles.small}>{t.provisional}</p>}
          <p className={styles.small}>{fill(t.method, { rules: match.rule_set })}</p>
        </div>
        <div className={styles.footActions}>
          {request ? (
            <>
              <ReportButton request={{ kind: "porondam", match: { ...request, lang } }} t={t} />
              {share && (
                <ShareButton
                  lang={lang}
                  t={share}
                  request={{ kind: "porondam", match: { ...request, lang } }}
                  title={fill(t.title, { bride: nameOf(bride, f.bride), groom: nameOf(groom, f.groom) })}
                  anonTitle={share.anonPorondam}
                  summary={fill(share.summaryPorondam, {
                    passed: match.score.passed,
                    total: match.score.total,
                  })}
                  hasNames={Boolean(bride.name || groom.name)}
                />
              )}
              {onAgain && (
                <button type="button" className={`btn btn-outline lift ${styles.again}`} onClick={onAgain}>
                  {t.again}
                  <ArrowRight />
                </button>
              )}
            </>
          ) : (
            readOnlyAction
          )}
        </div>
      </section>
    </main>
  );
}
