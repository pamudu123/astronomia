"use client";

import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { KujaDials } from "@/components/KujaDials";
import { ReportButton } from "@/components/ReportButton";
import { ShareButton } from "@/components/ShareButton";
import { UpcomingChanges } from "@/components/changes/UpcomingChanges";
import { YearlyLink } from "@/components/yearly/YearlyLink";
import {
  type BirthRequest,
  type Hadahan,
  type Labels,
  fill,
  formatDate,
  formatDegree,
} from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import { DashaTimeline } from "./DashaTimeline";
import { Forecast } from "./Forecast";
import styles from "./HadahanResult.module.css";
import { Kendara } from "./Kendara";
import { SummaryCards } from "./SummaryCards";

type Props = {
  lang: Locale;
  t: Dictionary["hadahan"]["result"];
  labels: Labels;
  result: Hadahan;
  name: string;
  date: string;
  time: string;
  placeText: string;
  /** Share text. Left out on a shared page, where nothing can be shared again. */
  share?: Dictionary["share"];
  /** The birth details. Left out on a shared page: then the result is read only. */
  request?: BirthRequest;
  onEdit?: () => void;
  /** The yearly forecast link. Left out on shared pages. */
  yearly?: Dictionary["yearly"];
};

/** What each step of the reading guide lights up: houses, and a planet to pick out. */
const GUIDE_FOCUS: ((moonHouse: number) => { houses: number[]; planet?: string })[] = [
  () => ({ houses: [1] }),
  () => ({ houses: [1, 2, 3, 4] }),
  (moonHouse) => ({ houses: [moonHouse], planet: "moon" }),
  () => ({ houses: [] }),
];

export function HadahanResult({
  lang,
  t,
  labels,
  result,
  name,
  date,
  time,
  placeText,
  share,
  request,
  onEdit,
  yearly,
}: Props) {
  const [mode, setMode] = useState<"rashi" | "navamsha">("rashi");
  const [step, setStep] = useState<number | null>(null);
  const chart = result.chart!;
  const kuja = result.kuja!;
  const sign = (key: string) => labels.rashi[key];
  const lagna = chart.lagna;
  const moon = chart.moon;
  const offset = result.time.offset_label ?? "";

  const kujaStatus = !kuja.present ? t.kujaAbsent : kuja.reduced ? t.kujaReduced : t.kujaPresent;
  const title = name ? fill(t.titleNamed, { name }) : t.title;
  const details = [
    formatDate(`${date}T00:00:00Z`, lang),
    fill(t.detailsTime, { time }),
    placeText,
    offset ? fill(t.detailsOffset, { offset }) : "",
  ].filter(Boolean);

  // The reading guide: which houses to light up at each step, with the chart in rashi view.
  const moonHouse = chart.planets.find((planet) => planet.body === "moon")?.house ?? 1;
  const guide = step === null ? null : GUIDE_FOCUS[step](moonHouse);
  const guideText =
    step === null
      ? ""
      : fill(t.guide[step], { lagna: sign(lagna.sign).name, moon: sign(moon.sign).name, house: moonHouse });

  return (
    <main id="main" className={`container ${styles.page}`}>
      <section className={`rise ${styles.top}`}>
        <div className={styles.topText}>
          <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
          <h1 className={`display ${styles.title}`}>{title}</h1>
        </div>
        {request && (
          <div className={styles.actions}>
            <ReportButton request={{ kind: "hadahan", name, birth: { ...request, lang } }} t={t} />
            {share && (
              <ShareButton
                lang={lang}
                t={share}
                request={{ kind: "hadahan", name, birth: { ...request, lang } }}
                title={title}
                anonTitle={share.anonHadahan}
                summary={fill(share.summaryHadahan, {
                  lagna: sign(lagna.sign).name,
                  rashi: sign(moon.sign).name,
                  star: labels.nakshatra[moon.nakshatra],
                })}
                hasNames={Boolean(name)}
              />
            )}
          </div>
        )}
      </section>

      {/* What the chart was worked out from, first, so a wrong time or place is caught early. */}
      <section className={`rise ${styles.details}`} aria-label={t.detailsUsed} data-card="details">
        <div className={styles.detailsText}>
          <span className={styles.detailsLabel}>{t.detailsUsed}</span>
          <p className={styles.detailsLine}>
            {details.map((part, index) => (
              <span key={index} className={styles.detailsPart}>
                {part}
              </span>
            ))}
          </p>
          {onEdit && <p className={styles.small}>{t.detailsHint}</p>}
        </div>
        {onEdit && (
          <button type="button" className={styles.outlineButton} onClick={onEdit}>
            {t.edit}
          </button>
        )}
      </section>

      <SummaryCards lang={lang} t={t} labels={labels} chart={chart} />

      <section className={styles.split}>
        <div className={`rise ${styles.panel} ${styles.chartPanel}`}>
          <div className={styles.panelRow}>
            <h2 className={`display ${styles.panelTitle}`}>{t.kendara}</h2>
            <div role="group" aria-label={t.chartType} className={styles.toggle}>
              {(["rashi", "navamsha"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  className={mode === value ? styles.toggleOn : styles.toggleOff}
                  onClick={() => {
                    setMode(value);
                    if (value === "navamsha") setStep(null);
                  }}
                >
                  {value === "rashi" ? t.chartRashi : t.chartNavamsha}
                </button>
              ))}
            </div>
          </div>
          <Kendara
            key={mode}
            planets={chart.planets}
            labels={labels}
            mode={mode}
            title={mode === "rashi" ? t.chartRashi : t.chartNavamsha}
            subtitle={formatDate(`${date}T00:00:00Z`, lang)}
            ariaLabel={fill(t.chartLabel, { chart: mode === "rashi" ? t.chartRashi : t.chartNavamsha })}
            lagnaMark={t.lagnaMark}
            highlight={guide ? guide.planet : kuja.present ? "mars" : undefined}
            houses={guide?.houses}
            numbered={guide !== null}
          />
          {step === null ? (
            <button
              type="button"
              className={styles.guideButton}
              aria-expanded={false}
              onClick={() => {
                setMode("rashi");
                setStep(0);
              }}
            >
              {t.howToRead}
            </button>
          ) : (
            <div className={styles.guide} data-card="guide">
              <p className={styles.guideStep}>{fill(t.guideStep, { n: step + 1, total: t.guide.length })}</p>
              <p aria-live="polite" className={styles.guideText}>
                {guideText}
              </p>
              <div className={styles.guideActions}>
                {step > 0 && (
                  <button type="button" className={styles.linkButton} onClick={() => setStep(step - 1)}>
                    {t.guideBack}
                  </button>
                )}
                {step < t.guide.length - 1 ? (
                  <button type="button" className={styles.outlineButton} onClick={() => setStep(step + 1)}>
                    {t.guideNext}
                  </button>
                ) : (
                  <button type="button" className={styles.outlineButton} onClick={() => setStep(null)}>
                    {t.guideClose}
                  </button>
                )}
              </div>
            </div>
          )}
          <p className={styles.small}>{t.kendaraNote}</p>
        </div>

        <div className={`rise ${styles.panel} ${styles.tablePanel}`} style={{ animationDelay: ".15s" }}>
          <h2 className={`display ${styles.panelTitle}`}>{t.planets}</h2>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t.planet}</th>
                  <th scope="col">{t.sign}</th>
                  <th scope="col">{t.degree}</th>
                  <th scope="col">{t.house}</th>
                  <th scope="col">{t.star}</th>
                </tr>
              </thead>
              <tbody>
                {chart.planets.map((planet) => (
                  <tr key={planet.body}>
                    <th scope="row" className={planet.body === "mars" && kuja.present ? styles.mars : undefined}>
                      {labels.planet[planet.body].name}
                    </th>
                    <td>
                      {sign(planet.sign).name}
                      {lang === "en" && <span className="soft"> ({sign(planet.sign).western})</span>}
                    </td>
                    <td className={styles.nowrap}>
                      {formatDegree(planet.degree)}
                      {planet.retrograde && planet.body !== "rahu" && planet.body !== "ketu" && (
                        <span className={styles.pill}>{t.retrograde}</span>
                      )}
                    </td>
                    <td>{planet.house}</td>
                    <td>
                      {labels.nakshatra[planet.nakshatra]} {planet.pada}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {result.dasha && <DashaTimeline dasha={result.dasha} labels={labels} lang={lang} t={t} />}

      {request && <Forecast lang={lang} t={t} labels={labels} request={request} />}

      {request && <UpcomingChanges lang={lang} t={t} request={request} />}

      {request && yearly && (
        <YearlyLink t={yearly} lang={lang} lagna={lagna.sign} lagnaName={sign(lagna.sign).name} />
      )}

      <section className={styles.pair}>
        <article className={`rise ${styles.panel} ${kuja.present ? styles.kujaPresent : ""}`} data-card="kuja">
          <div className={styles.panelRow}>
            <h2 className={`display ${styles.panelTitle}`}>{t.kuja}</h2>
            <span className={kuja.present ? styles.badgeCoral : styles.badgeTeal}>{kujaStatus}</span>
          </div>
          {kuja.present && <p className="soft">{fill(t.kujaStrength, { count: kuja.strength })}</p>}
          <KujaDials kuja={kuja} labels={labels} t={t} />
          {kuja.reasons.map((text) => (
            <p key={text}>{text}</p>
          ))}
          {kuja.present && (
            <>
              <h3 className={styles.subTitle}>{t.kujaChecks}</h3>
              <ul className={styles.checks}>
                {kuja.cancellations.map((check) => (
                  <li key={check.id} className={check.applies ? styles.checkOn : styles.checkOff}>
                    <span className={styles.checkHead}>
                      <span>{labels.kuja_rule[check.id]}</span>
                      <span className={check.applies ? styles.checkYes : styles.checkNo}>
                        {check.applies ? t.applies : t.notApplies}
                      </span>
                    </span>
                    <span className="soft">{check.reason}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {kuja.provisional && <p className={styles.small}>{t.provisional}</p>}
        </article>

        <article className={`rise ${styles.panel}`} style={{ animationDelay: ".1s" }} data-card="time">
          <div className={styles.panelRow}>
            <h2 className={`display ${styles.panelTitle}`}>{t.timeCheck}</h2>
            <span className={chart.time_check.stable ? styles.badgeTeal : styles.badgeCoral}>
              {chart.time_check.stable ? t.stable : t.sensitive}
            </span>
          </div>
          <p className="soft">{chart.time_check.reason}</p>
          <p className={styles.small}>{fill(t.method, { ayanamsa: t.ayanamsaLahiri, offset })}</p>
        </article>
      </section>

    </main>
  );
}
