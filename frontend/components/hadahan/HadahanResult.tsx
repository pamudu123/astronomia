"use client";

import { useEffect, useMemo, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { KujaDials } from "@/components/KujaDials";
import { NextSteps } from "@/components/NextSteps";
import { ArrowRight } from "@/components/Icons";
import { ReportButton } from "@/components/ReportButton";
import { SaveButton } from "@/components/account/SaveButton";
import { DetailLocked, FullReport } from "@/components/paid/FullReport";
import { PaidOnly, ReportScope } from "@/components/paid/ReportAccess";
import { SaveGate } from "@/components/account/SaveGate";
import { ShareButton } from "@/components/ShareButton";
import { SavedTime, type SavedTimes } from "@/components/account/SavedTime";
import { UpcomingChanges } from "@/components/changes/UpcomingChanges";
import { YearlyLink } from "@/components/yearly/YearlyLink";
import {
  type BirthRequest,
  type Hadahan,
  type Labels,
  type AnyHadahan,
  fill,
  formatDate,
  formatDegree,
} from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import { ChartDiagram } from "@/components/assistant/ChapterDiagram";
import { AiExplain, FullReading, TopicChips } from "@/components/assistant/Explain";
import { useAssistantContext, useAssistantVisuals } from "@/components/assistant/PageContext";
import { useReading } from "@/components/assistant/useReading";
import {
  CHART_EXTRA,
  CHART_PLACES,
  CHART_READING,
  CHART_TOPICS,
  type ChapterId,
} from "@/lib/assistant/explain";
import { chartContext, chartExtrasContext, chartReadingContext } from "@/lib/assistant/pages";
import { type Upcoming, fetchUpcomingChanges } from "@/lib/changes";
import { type Journey, fetchJourney } from "@/lib/journey";

import { DashaTimeline } from "./DashaTimeline";
import { Forecast } from "./Forecast";
import styles from "./HadahanResult.module.css";
import { Kendara } from "./Kendara";
import { LifeRoad } from "./LifeRoad";
import { RememberChart } from "./RememberChart";
import { SummaryCards } from "./SummaryCards";

type Props = {
  lang: Locale;
  t: Dictionary["hadahan"]["result"];
  labels: Labels;
  result: AnyHadahan;
  name: string;
  /** The birth details. Null on a shared page whose sender kept them hidden. */
  date: string | null;
  time: string | null;
  placeText: string | null;
  /** The heading without a name. A shared page says "A hadahan", not "Your birth chart". */
  anonTitle?: string;
  /** Share text. Left out on a shared page, where nothing can be shared again. */
  share?: Dictionary["share"];
  /** Text for the Save button. Left out where the result is already saved or read only. */
  saveText?: Dictionary["saved"];
  /** The birth details. Left out on a shared page: then the result is read only. */
  request?: BirthRequest;
  onEdit?: () => void;
  /** Starts over with an empty form, for another person. Left out where the result is read only. */
  onAgain?: () => void;
  /** The yearly forecast link. Left out on shared pages. */
  yearly?: Dictionary["yearly"];
  /** Next steps and Remember my chart. Left out on shared pages. */
  next?: Dictionary["next"];
  remember?: Dictionary["remember"];
  /** Only on a saved report: labels the parts kept from that day and those worked out today. */
  savedTimes?: SavedTimes;
};

/** What each step of the reading guide lights up: houses, and a planet to pick out. */
const GUIDE_FOCUS: ((moonHouse: number) => { houses: number[]; planet?: string })[] = [
  () => ({ houses: [1] }),
  () => ({ houses: [1, 2, 3, 4] }),
  (moonHouse) => ({ houses: [moonHouse], planet: "moon" }),
  () => ({ houses: [] }),
];

/**
 * The result, with what the account may use on this report around all of it: the reading and the
 * PDF ask for it too, so nothing in the page sits outside.
 */
export function HadahanResult(props: Props) {
  const { lang, request, name } = props;
  return (
    <ReportScope
      report={request ? { kind: "hadahan", name, birth: { ...request, lang } } : null}
      kind="hadahan"
      kuja={props.result.kuja?.present ?? false}
    >
      <HadahanResultPage {...props} />
    </ReportScope>
  );
}

function HadahanResultPage({
  lang,
  t,
  labels,
  result,
  name,
  date,
  time,
  placeText,
  anonTitle,
  share,
  saveText,
  request,
  onEdit,
  onAgain,
  yearly,
  next,
  remember,
  savedTimes,
}: Props) {
  const [mode, setMode] = useState<"rashi" | "navamsha">("rashi");
  // What the AI assistant sees: this result, with no birth details.
  useAssistantContext(chartContext(result, labels, lang, !request));
  // The diagrams Astro may show: drawn in the browser, from what this page shows.
  const birth = request?.date ?? date;
  // Compared by its words: a saved report's page makes the object anew on every render.
  const { frozen, live } = savedTimes ?? {};
  useAssistantVisuals(
    useMemo(
      () => ({ kind: "chart" as const, result, labels, birth, ...(frozen && live && { saved: { frozen, live } }) }),
      [result, labels, birth, frozen, live],
    ),
  );
  // What the written reading gets: the same, with every later life period and the Mars
  // check's rules. Kept stable, so each chapter is written once per visit.
  const reading = chartReadingContext(result, labels, lang, !request);
  const readingKey = JSON.stringify(reading);
  const facts = useMemo(() => reading, [readingKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Two chapters also need the life road's Saturn periods and the planet changes ahead. The
  // sections below fetch the same data; the requests are shared (lib/journey, lib/changes).
  const [extras, setExtras] = useState<{ journey: Journey | null; upcoming: Upcoming | null } | null>(null);
  useEffect(() => {
    if (!request) return;
    let live = true;
    void Promise.allSettled([fetchJourney(request, lang), fetchUpcomingChanges(request, lang)]).then(
      ([journey, upcoming]) => {
        if (!live) return;
        setExtras({
          journey: journey.status === "fulfilled" ? journey.value.journey : null,
          upcoming: upcoming.status === "fulfilled" ? upcoming.value : null,
        });
      },
    );
    return () => {
      live = false;
    };
  }, [request, lang]);
  // On a shared chart there is no birth to ask with: those chapters use the chart alone.
  const extraFacts = useMemo(() => {
    if (!request) return undefined;
    const withExtras = extras ? chartExtrasContext(facts, extras) : null;
    return Object.fromEntries(CHART_EXTRA.map((id) => [id, withExtras]));
  }, [request, extras, facts]);
  // The reading's chapters, then the topic-only ones: what the chat hears about and the PDF
  // prints (the paid PDF writes any not written yet).
  const { forPdf, aiNotice } = useReading(
    {
      ids: [...CHART_READING, ...CHART_TOPICS.filter((id) => !CHART_READING.includes(id))],
      factsFor: (id: ChapterId) => (extraFacts && id in extraFacts ? (extraFacts[id] ?? null) : facts),
    },
    lang,
    "chart",
  );
  // The diagram under each chapter's short answer; the PDF prints the same ones.
  const diagram = (id: ChapterId) => (
    <ChartDiagram
      id={id}
      result={result}
      labels={labels}
      birth={request?.date ?? date}
      saved={savedTimes && <SavedTime times={savedTimes} part="frozen" />}
    />
  );
  const [step, setStep] = useState<number | null>(null);
  const chart = result.chart!;
  const kuja = result.kuja!;
  const sign = (key: string) => labels.rashi[key];
  const lagna = chart.lagna;
  const moon = chart.moon;
  const offset = result.time?.offset_label ?? "";
  // The birth details as a shared page would show them, for the share dialog's list.
  const birthLine = date
    ? [formatDate(`${date}T00:00:00Z`, lang), [time, offset && fill(t.detailsOffset, { offset })].filter(Boolean).join(" "), placeText]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  // The jump bar: only the parts this page shows. A shared chart has no birth to ask with.
  const sections: [string, string][] = [
    ["chart", t.sectionChart],
    ...(result.dasha || request ? [["periods", t.periodsTitle] as [string, string]] : []),
    ...(request ? [["coming", t.comingTitle] as [string, string]] : []),
    ["kuja", t.kuja],
  ];

  const kujaStatus =!kuja.present ? t.kujaAbsent : kuja.reduced ? t.kujaReduced : t.kujaPresent;
  const title = name ? fill(t.titleNamed, { name }) : (anonTitle ?? t.title);

  // The reading guide: which houses to light up at each step, with the chart in rashi view.
  const moonHouse = chart.planets.find((planet) => planet.body === "moon")?.house ?? 1;
  const guide = step === null ? null : GUIDE_FOCUS[step](moonHouse);
  const guideText =
    step === null
      ? ""
      : fill(t.guide[step], { lagna: sign(lagna.sign).name, moon: sign(moon.sign).name, house: moonHouse });

  return (
    <>
    <main id="main" className={`container ${styles.page}`}>
      <section className={`rise ${styles.top}`}>
        <div className={styles.topText}>
          <span className={`sinhala ${styles.eyebrow}`}>{t.eyebrow}</span>
          <h1 className={`display ${styles.title}`}>{title}</h1>
        </div>
        {request && (
          <div className={styles.actions}>
            <ReportButton
              request={{ kind: "hadahan", name, birth: { ...request, lang } }}
              reading={forPdf}
                aiNotice={aiNotice}
              t={t}
            />
            {saveText && (
              <SaveGate>
                <SaveButton
                  key={JSON.stringify(request) + name}
                  lang={lang}
                  t={saveText}
                  request={{ kind: "hadahan", name, birth: { ...request, lang } }}
                />
              </SaveGate>
            )}
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
                names={name}
                birth={birthLine}
                fields={[
                  share.fieldChart,
                  share.fieldTimeCheck,
                  ...(result.dasha ? [share.fieldDasha] : []),
                  share.fieldKuja,
                ]}
              />
            )}
          </div>
        )}
      </section>

      {/* What the chart was worked out from, first, so a wrong time or place is caught early.
          A shared page whose sender hid the birth details has none to show. */}
      {date && (
      <section className={`rise ${styles.details}`} aria-label={t.detailsUsed} data-card="details">
        <div className={styles.detailsHead}>
          <span className={styles.detailsLabel}>{t.detailsUsed}</span>
          {(onEdit || onAgain) && (
            <div className={styles.detailsActions}>
              {onEdit && (
                <button type="button" className={styles.editButton} onClick={onEdit}>
                  {t.edit}
                </button>
              )}
              {/* Also at the end of the page: nobody should have to scroll there to start again. */}
              {onAgain && (
                <button type="button" className={styles.editButton} onClick={onAgain}>
                  {t.again}
                </button>
              )}
            </div>
          )}
        </div>
        {/* Each detail with its own label, so a wrong date, time or place stands out. */}
        <dl className={styles.detailsList}>
          <div className={styles.detailsItem}>
            <dt>{t.detailsDate}</dt>
            <dd>{formatDate(`${date}T00:00:00Z`, lang)}</dd>
          </div>
          <div className={styles.detailsItem}>
            <dt>{t.detailsTimeLabel}</dt>
            <dd>
              {time}
              {offset && <span className={styles.detailsSoft}>{fill(t.detailsOffset, { offset })}</span>}
            </dd>
          </div>
          {placeText && (
            <div className={styles.detailsItem}>
              <dt>{t.detailsPlace}</dt>
              <dd>{placeText}</dd>
            </div>
          )}
        </dl>
        {onEdit && <p className={styles.small}>{t.detailsHint}</p>}
      </section>
      )}

      {/* A short bar to jump between the parts of a long page. */}
      <nav className={styles.sections} aria-label={t.sections}>
        {sections.map(([id, label]) => (
          <a key={id} href={`#${id}`} className={styles.sectionLink}>
            {label}
          </a>
        ))}
      </nav>

      <div id="chart" className={styles.group}>
        <SummaryCards
          lang={lang}
          t={t}
          labels={labels}
          chart={chart}
          explain={<AiExplain chapters={CHART_PLACES.chart} lang={lang} facts={facts} />}
        />

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
              subtitle={date ? formatDate(`${date}T00:00:00Z`, lang) : undefined}
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
                      <td>{sign(planet.sign).name}</td>
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

        <TopicChips chapters={CHART_TOPICS} lang={lang} facts={facts} diagram={diagram} />
      </div>

      {(result.dasha || request) && (
        <section id="periods" className={styles.group} aria-labelledby="periods-title">
          <h2 id="periods-title" className={`display ${styles.groupTitle}`}>
            {t.periodsTitle}
          </h2>
          {result.dasha && (
            <DashaTimeline
              dasha={result.dasha}
              labels={labels}
              lang={lang}
              t={t}
              explain={<AiExplain chapters={CHART_PLACES.periods} lang={lang} facts={facts} />}
              note={<SavedTime times={savedTimes} part="frozen" />}
            />
          )}
          {request && (
            <LifeRoad
              lang={lang}
              t={t}
              labels={labels}
              request={request}
              note={<SavedTime times={savedTimes} part="live" />}
            />
          )}
        </section>
      )}

      {request && (
        <section id="coming" className={styles.group} aria-labelledby="coming-title">
          <h2 id="coming-title" className={`display ${styles.groupTitle}`}>
            {t.comingTitle}
          </h2>
          <SavedTime times={savedTimes} part="live" />
          <Forecast lang={lang} t={t} labels={labels} request={request} />
          <UpcomingChanges lang={lang} t={t} request={request} />
          {yearly && <YearlyLink t={yearly} lang={lang} lagna={lagna.sign} lagnaName={sign(lagna.sign).name} />}
        </section>
      )}

      <section id="kuja" className={`${styles.pair} ${styles.anchor}`}>
        <article className={`rise ${styles.panel} ${kuja.present ? styles.kujaPresent : ""}`} data-card="kuja">
          <div className={styles.panelRow}>
            <h2 className={`display ${styles.panelTitle}`}>{t.kuja}</h2>
            <span className={kuja.present ? styles.badgeCoral : styles.badgeTeal}>{kujaStatus}</span>
          </div>
          {kuja.reasons.map((text) => (
            <p key={text}>{text}</p>
          ))}
          {/* The working is there for whoever wants it, folded away for everyone else. */}
          <details className={styles.more}>
            <summary>{t.kujaHow}</summary>
            {kuja.present && <p className="soft">{fill(t.kujaStrength, { count: kuja.strength })}</p>}
            <KujaDials kuja={kuja} labels={labels} t={t} />
            {kuja.present && (
              <PaidOnly feature="full_detail" locked={<DetailLocked lang={lang} />}>
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
              </PaidOnly>
            )}
          </details>
          <AiExplain chapters={CHART_PLACES.mars} lang={lang} facts={facts} />
        </article>

        <article className={`rise ${styles.panel}`} style={{ animationDelay: ".1s" }} data-card="time">
          <div className={styles.panelRow}>
            <h2 className={`display ${styles.panelTitle}`}>{t.timeCheck}</h2>
            <span className={chart.time_check.stable ? styles.badgeTeal : styles.badgeCoral}>
              {chart.time_check.stable ? t.stable : t.sensitive}
            </span>
          </div>
          <p className="soft">{chart.time_check.reason}</p>
          <details className={styles.more}>
            <summary>{t.methodLabel}</summary>
            <p className={styles.small}>{fill(t.method, { ayanamsa: t.ayanamsaLahiri, offset })}</p>
          </details>
        </article>
      </section>

      {/* Getting the full report, then the reading it unlocks. */}
      {request && <FullReport lang={lang} />}

      {/* The long chapter reading comes last, so the chart itself is what shows first. */}
      <FullReading
        chapters={CHART_READING}
        lang={lang}
        facts={facts}
        extra={extraFacts}
        reading="chartReading"
        diagram={diagram}
        pdf={Boolean(request)}
      />

      {/* One note for the whole page, in place of one under every section. */}
      <p className={styles.pageNote} data-card="note">
        {t.pageNote}
      </p>

      {onAgain && (
        <button type="button" className={`btn btn-outline lift ${styles.again}`} onClick={onAgain}>
          {t.again}
          <ArrowRight />
        </button>
      )}

      {request && next && (
        <NextSteps
          title={next.title}
          steps={[
            { id: "baby-names", href: `/${lang}/baby-names`, label: next.hadahan.babyNames },
            { id: "first-letters", href: `/${lang}/first-letters`, label: next.hadahan.firstLetters },
            { id: "porondam", href: `/${lang}/porondam`, label: next.hadahan.porondam },
            { id: "litha", href: `/${lang}/litha`, label: next.hadahan.litha },
          ]}
        >
          {/* Only on the visitor's own result, which always has its birth details. */}
          {remember && (
            <RememberChart t={remember} saved={{ name, placeLabel: placeText ?? "", request, result: result as Hadahan, lang }} />
          )}
        </NextSteps>
      )}
    </main>
    </>
  );
}
