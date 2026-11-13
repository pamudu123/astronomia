"use client";

import Image from "next/image";
import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { KujaDials } from "@/components/KujaDials";
import { ReportButton } from "@/components/ReportButton";
import { ShareButton } from "@/components/ShareButton";
import { UpcomingChanges } from "@/components/changes/UpcomingChanges";
import {
  type BirthRequest,
  type Hadahan,
  type Labels,
  fill,
  formatDate,
  formatDegree,
} from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { RASHI } from "@/lib/rashi";

import { DashaTimeline } from "./DashaTimeline";
import { Forecast } from "./Forecast";
import styles from "./HadahanResult.module.css";
import { Kendara } from "./Kendara";

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
};

function rashiImage(key: string): string {
  return RASHI.find((r) => r.key === key)?.image ?? "";
}

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
}: Props) {
  const [mode, setMode] = useState<"rashi" | "navamsha">("rashi");
  const chart = result.chart!;
  const kuja = result.kuja!;
  const sign = (key: string) => labels.rashi[key];
  const lagna = chart.lagna;
  const moon = chart.moon;
  const offset = result.time.offset_label ?? "";

  const kujaStatus = !kuja.present ? t.kujaAbsent : kuja.reduced ? t.kujaReduced : t.kujaPresent;

  const cards = [
    {
      id: "lagna",
      label: t.lagna,
      value: sign(lagna.sign).name,
      sub: lang === "en" ? `${sign(lagna.sign).western}` : formatDegree(lagna.degree),
      text: t.lagnaText,
      image: rashiImage(lagna.sign),
    },
    {
      id: "rashi",
      label: t.rashi,
      value: sign(moon.sign).name,
      sub: lang === "en" ? `${sign(moon.sign).western}` : formatDegree(moon.degree),
      text: t.rashiText,
      image: rashiImage(moon.sign),
    },
    {
      id: "nakath",
      label: t.nakath,
      value: labels.nakshatra[moon.nakshatra],
      sub: fill(t.pada, { pada: moon.pada }),
      text: t.nakathText,
      image: null,
    },
  ];

  return (
    <main id="main" className={`container ${styles.page}`}>
      <section className={`rise ${styles.top}`}>
        <div className={styles.topText}>
          <h1 className={`display ${styles.title}`}>{name ? fill(t.titleNamed, { name }) : t.title}</h1>
          <p className="soft">
            {formatDate(`${date}T00:00:00Z`, lang)} · {time} · {placeText}
          </p>
        </div>
        {request && (
          <div className={styles.actions}>
            <ReportButton request={{ kind: "hadahan", name, birth: { ...request, lang } }} t={t} />
            {share && (
              <ShareButton
                lang={lang}
                t={share}
                request={{ kind: "hadahan", name, birth: { ...request, lang } }}
                title={name ? fill(t.titleNamed, { name }) : t.title}
                anonTitle={share.anonHadahan}
                summary={fill(share.summaryHadahan, {
                  lagna: sign(lagna.sign).name,
                  rashi: sign(moon.sign).name,
                  star: labels.nakshatra[moon.nakshatra],
                })}
                hasNames={Boolean(name)}
              />
            )}
            {onEdit && (
              <button type="button" className={styles.outlineButton} onClick={onEdit}>
                {t.edit}
              </button>
            )}
          </div>
        )}
      </section>

      <section className={styles.cards} aria-label={t.lagna}>
        {cards.map((card, index) => (
          <article key={card.id} className={`rise lift ${styles.card}`} style={{ animationDelay: `${0.1 * (index + 1)}s` }} data-card={card.id}>
            {card.image ? (
              <Image src={card.image} alt="" width={112} height={112} unoptimized={card.image.endsWith(".svg")} />
            ) : (
              <svg aria-hidden="true" viewBox="0 0 200 80" className={styles.stars}>
                <path d="M30 60L70 24L112 40L150 20" fill="none" stroke="var(--line)" strokeWidth="1.2" />
                <circle cx="30" cy="60" r="3" fill="var(--ink)" />
                <circle cx="70" cy="24" r="4" fill="var(--coral)" />
                <circle cx="112" cy="40" r="3" fill="var(--ink)" />
                <circle cx="150" cy="20" r="3.5" fill="var(--ink)" />
              </svg>
            )}
            <div className={styles.cardValue}>
              <span className={styles.cardLabel}>{card.label}</span>
              <span className={`display ${styles.cardName}`}>{card.value}</span>
              <span className={styles.cardSub}>{card.sub}</span>
            </div>
            <p className={styles.cardText}>{card.text}</p>
          </article>
        ))}
      </section>

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
                  onClick={() => setMode(value)}
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
            highlight={kuja.present ? "mars" : undefined}
          />
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
